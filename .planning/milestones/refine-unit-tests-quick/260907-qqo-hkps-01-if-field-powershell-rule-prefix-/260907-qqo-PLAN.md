---
phase: 260907-qqo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/powershell.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
  - tests/domain/components/hook-if-targets.test.ts
  - tests/bridges/hooks/if-field/glob.test.ts
  - tests/bridges/hooks/if-field/powershell.test.ts
  - tests/bridges/hooks/if-field/index.test.ts
  - docs/hooks-compatibility.md
autonomous: true
requirements: [HKPS-01]

estimate:
  tokens: 110000
  raw_tokens: 110000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - A hook handler whose `if` field reads `PowerShell(Get-ChildItem *)` fires
      on a Pi `powershell` tool event whose `input.command` is
      `Get-ChildItem -Path .`, and does NOT fire on `Remove-Item foo`.
    - The same rule fires when the runtime command uses an alias
      (`gci foo`, `ls foo`, `dir foo`), and a rule written with an alias
      (`PowerShell(gci *)`) fires on the canonical `Get-ChildItem foo`.
    - Matching is case-insensitive in both directions — a
      `PowerShell(Get-ChildItem *)` rule fires on `get-childitem foo`, and a
      `PowerShell(get-childitem *)` rule fires on `Get-ChildItem foo`.
    - A compound PowerShell command splits on `;`, `|`, `&&`, `||`, and newline,
      and each subcommand is matched independently; a bare `&` does NOT split.
    - A separator inside single quotes, inside double quotes, or preceded by a
      backtick escape does NOT split the command.
    - A backtick is an escape character rather than command substitution, so the
      bridge never parses a backtick-delimited region as a nested subcommand.
    - Subexpression bodies written as `$(...)` ARE parsed recursively, and input
      nested past the depth cap falls open (the hook fires) instead of throwing.
    - No process-wrapper stripping happens on the PowerShell path, so
      `timeout foo` parses to `timeout foo` unchanged.
    - A `Bash(...)` rule does not fire on a `powershell` event, and a
      `PowerShell(...)` rule does not fire on a `bash` event, even when both
      carry the same `input.command`.
    - Behavior is identical on every platform — no `process.platform` read
      exists on any of the touched paths.
  artifacts:
    - extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts
      carries a `PowerShell` entry immediately after `Bash`.
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts exports
      `compilePowerShellGlob` and `CompiledPowerShellGlob`.
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/powershell.ts
      exports `parsePowerShellSubcommands`, `powerShellSubcommandFires`, and the
      rule-compile helper, and owns the alias table.
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts carries a
      sixth `IfPredicate` arm with discriminant `"powershell"`.
    - tests/bridges/hooks/if-field/powershell.test.ts exists as the direct owner
      of the new module (the corresponding-test gate requires it).
    - docs/hooks-compatibility.md lists `PowerShell(...)` as supported and lists
      `powershell` in the Pi-tool-name table.
  key_links:
    - compileIfPrefixForm `PowerShell` branch -> IF_PREFIX_TARGETS.PowerShell ->
      the rule-compile helper -> compilePowerShellGlob.
    - ifFires `powershell` arm -> extractToolName membership guard ->
      parsePowerShellSubcommands -> powerShellSubcommandFires.
    - ifFires `bash` arm -> the NEW extractToolName membership guard against
      IF_PREFIX_TARGETS.Bash.piEvents (this is what keeps the two
      command-bearing prefixes from cross-firing).
    - powerShellSubcommandFires -> the alias table (runtime head) AND the
      rule-compile helper -> the alias table (pattern head). Both sides must be
      canonicalized or the alias/canonical cross-match cannot work.
---

<objective>
HKPS-01: teach the hooks `if`-field matcher the upstream `PowerShell(...)`
permission-rule prefix, so a Claude plugin whose hook filters on PowerShell
commands filters the same way under Pi instead of falling open on every event.

Purpose: Pi already ships a first-class `powershell` tool and the bridge already
maps `powershell <-> PowerShell` for matchers. Only the `if` field was left
behind — a `PowerShell(...)` rule currently compiles to the fall-open sentinel,
so the hook fires on every matcher hit. That is the documented safe default, but
it is not upstream parity.

Output: a `PowerShell` row in the prefix table, a case-insensitive command-glob
compiler beside the Bash one, a new `powershell.ts` subcommand parser with the
upstream alias table, a sixth predicate arm, a tool-name guard on BOTH
command-bearing arms, and the compatibility doc corrected.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace-powershell/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace-powershell/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/rules/typescript-comments.md
@.claude/rules/typescript-unit-testing.md

@extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts
@extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts
@extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
@extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts
@.planning/quick/260907-qqo-hkps-01-if-field-powershell-rule-prefix-/260907-qqo-upstream-alias-table.txt

Project skills to apply while writing code and tests:
`.agents/skills/typescript-google-style-review/SKILL.md` and
`.agents/skills/typescript-unit-testing-review/SKILL.md`.

## Upstream authority (verified 2026-09-07, code.claude.com/docs/en/permissions)

> PowerShell permission rules use the same shape as Bash rules. Wildcards with
> `*` match at any position, the `:*` suffix is equivalent to a trailing ` *`,
> and a bare `PowerShell` or `PowerShell(*)` matches every command. ... Common
> aliases are canonicalized before matching. A rule written for the cmdlet name
> also matches its aliases, so `PowerShell(Get-ChildItem *)` matches `gci`, `ls`,
> and `dir` as well. Matching is case-insensitive. Claude Code parses the
> PowerShell AST and checks each command in a compound command independently.
> Pipeline operators `|`, statement separators `;`, and on PowerShell 7+ the
> chain operators `&&` and `||` split a compound command into subcommands.

Upstream shells out to pwsh's real parser. We hand-author the documented
contract per the D-61-01 zero-new-deps stance and fail open on anything
uncertain — the same stance `bash.ts` already takes.

## Facts established at planning time — do not re-derive

1. `glob.ts` keeps `tokenize` and `matchTokens` module-private. Because
   `compilePowerShellGlob` lands in the SAME file, it can call them directly.
   Do not export them.
2. `matchBashGlob` (`glob.ts:283`) is language-agnostic once the case fold is
   applied by the caller: it is a `matchTokens` call plus the trailing-space
   word-boundary retry. Factor it into ONE shared helper both compiled command
   globs call, rather than writing a near-identical `matchPowerShellGlob` —
   fallow `dupes` runs at `threshold: 3` and a copy would trip it.
3. `BASH_COMMAND_NAME_ONLY = /^[A-Za-z0-9_./-]+(\s+\*)?$/` already admits the
   `-` in cmdlet names, but NOT the single-char aliases `%` and `?`. Add a
   PowerShell-specific sibling regex; do not widen the Bash one.
4. `IF_PREFIX_TARGETS` is pinned by `tests/domain/components/hook-if-targets.test.ts`
   in TWO places: the `deepStrictEqual` table and the key-order tuple. Both need
   the new row, in the locked position (immediately after `Bash`).
5. `tests/architecture/hooks-if-field.test.ts` projects only `predicateKind` off
   each routing row, so the new `piEvents` field on the `bash` predicate does not
   leak into its assertion. Its table is NOT per-kind exhaustive either —
   `mcp-server-prefix` is absent — so a `powershell` row is not warranted by its
   grain. Verify it stays green; do not extend it.
6. `tests/bridges/hooks/dispatch.test.ts` is the only other suite that builds
   real (non-sentinel) `if` predicates. Every event it feeds carries
   `toolName: "bash"` (`createToolCallEvent` defaults to it at line 189-199), so
   the new bash-arm guard leaves it green. Verify, do not edit.
7. `npm run check` runs `test:corresponding`, so the new production module
   `powershell.ts` REQUIRES `tests/bridges/hooks/if-field/powershell.test.ts` at
   the mirrored path or the gate fails before the tests run.
8. `npm run format:check` was verified clean in this checkout at planning time
   (only `.claude/settings.json`, which `.prettierignore` excludes, and the
   untracked planning directory are dirty). `npm run check` therefore runs end to
   end here; STATE.md's standing `format:check` short-circuit debt does not apply.
9. `docs/*.md` is formatted by `mdformat` + `markdownlint-cli2` under
   `pre-commit`, NOT by prettier. Match the existing `\|` escaping inside table
   cells.

## Planner decisions inside the operator's "planner's choice" latitude

- **The alias table lives in `powershell.ts`, not `glob.ts`.** `glob.ts` stays a
  language-agnostic matching engine. `powershell.ts` exports a rule-compile
  helper (`compilePowerShellRule`) that canonicalizes the PATTERN's head token
  and then delegates to `compilePowerShellGlob`; `index.ts` calls that helper.
  This is what makes the alias cross-match work in both directions, because the
  runtime head is canonicalized separately at match time.
- **Predicate arm field name is `psGlob`**, discriminant `"powershell"` (locked).
- **`CompiledPowerShellGlob` is declared as its own exported interface** with its
  own doc comment. It is structurally identical to `CompiledBashGlob`; that is
  accepted and no nominal brand is added. IF fallow `dupes` flags the two
  declarations as a clone, collapse it to
  `export type CompiledPowerShellGlob = CompiledBashGlob;` with a doc comment
  saying the compiled shape is shared and only the compile-time folding differs.
  Do not add a `dupes.ignoredClones` entry for it.

## Out of scope

- Version bump, `CHANGELOG.md`, `sonar-project.properties`, `EXTENSION_VERSION`.
- Any `process.platform` read, any pwsh subprocess, any new dependency.
- `Cd(...)`, `WebFetch(...)`, `Agent(...)`, parameter matching, tool-name
  wildcards — all still fall open.
- The `bash.ts` parser itself. Only `index.ts`'s bash ARM changes (the tool-name
  guard and the new `piEvents` field on the predicate).
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Fire a PowerShell rule end-to-end, and stop Bash rules cross-firing</name>
  <files>
    extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts,
    extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts,
    extensions/pi-claude-marketplace/bridges/hooks/if-field/powershell.ts,
    extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts,
    tests/domain/components/hook-if-targets.test.ts,
    tests/bridges/hooks/if-field/powershell.test.ts,
    tests/bridges/hooks/if-field/index.test.ts
  </files>
  <behavior>
    - `compileIfPredicate("PowerShell(Get-ChildItem *)", "PreToolUse", ctx)`
      returns a predicate whose `kind` is `"powershell"`.
    - `ifFires` on that predicate returns true for
      `{ toolName: "powershell", input: { command: "Get-ChildItem -Path ." } }`
      and false for `{ toolName: "powershell", input: { command: "Remove-Item x" } }`.
    - The same predicate returns false for
      `{ toolName: "bash", input: { command: "Get-ChildItem -Path ." } }`.
    - A `Bash(git *)` predicate returns false for
      `{ toolName: "powershell", input: { command: "git status" } }` and stays
      true for the same command on `toolName: "bash"`.
    - `IF_PREFIX_TARGETS` key order is exactly
      `["Bash", "PowerShell", "Read", "Edit", "Write"]`.
  </behavior>
  <action>
    Land the whole vertical slice in one commit: prefix table -> glob compiler ->
    PowerShell parser -> predicate arm -> dispatch consult. Each layer below is
    the minimum that makes the behavior above true; Task 2 adds the exhaustive
    truth tables.

    **hook-if-targets.ts.** Add a `PowerShell` entry immediately after `Bash`:
    `piEvents: new Set&lt;PiToolName&gt;(["powershell"])`, `extractTarget: "command"`.
    Update the D-61-03 doc comments so they describe the table as it now stands —
    a five-entry closed set spelled `Bash | PowerShell | Read | Edit | Write`, the
    load-bearing-gate paragraph's "removing any of the five entries", and its
    "adding a sixth entry without amending the test fails CI". Add a `PowerShell`
    bullet to the per-key list on the `IF_PREFIX_TARGETS` JSDoc, citing HKPS-01
    and naming the upstream authority. Per `.claude/rules/typescript-comments.md`,
    write every comment as a present-tense fact about the code as it now stands —
    do not narrate what the table used to hold.

    **glob.ts.** Add `CompiledPowerShellGlob` (same members as `CompiledBashGlob`;
    see the planner decision in `<context>` for the dupes fallback) and
    `compilePowerShellGlob(raw)`. Extract the shared parts rather than copying
    them: one helper that applies the `:*` colon-sugar normalization and reports
    the trailing word-boundary flag, and one shared matcher helper that both
    `compileBashGlob` and `compilePowerShellGlob` call (this is the current
    `matchBashGlob` body — a `matchTokens` call with `crossSegment` true plus the
    trailing-space retry). `compilePowerShellGlob` folds the NORMALIZED pattern to
    lower case before tokenizing and folds the incoming subcommand to lower case
    inside `test()`; `raw` records the caller's string unfolded. Compute
    `isCommandNameOnly` with a PowerShell-specific regex that also admits `%` and
    `?`; leave `BASH_COMMAND_NAME_ONLY` alone. Doc-comment the case-insensitivity
    with the upstream sentence and the HKPS-01 anchor. Keep the pure-and-total
    contract: it must never throw.

    **powershell.ts (new).** Sibling of `bash.ts`, same file-header shape and the
    same discriminated `ParseResult`-style return (re-use the exported
    `ParseResult` type from `./bash.ts` rather than declaring a second identical
    union). Contents:

    - `POWERSHELL_ALIASES`: a module const mapping lowercase alias to canonical
      cmdlet name, transcribed VERBATIM from
      `.planning/quick/260907-qqo-hkps-01-if-field-powershell-rule-prefix-/260907-qqo-upstream-alias-table.txt`
      (about 80 rows, starting `ls` and ending `sls`, including the `%` and `?`
      keys). Do not add, drop, or "fix" a row. Type it
      `ReadonlyMap&lt;string, string&gt;` or a `Readonly&lt;Record&lt;string, string&gt;&gt;`
      read through `Object.hasOwn` — whichever keeps the lookup total under
      `noUncheckedIndexedAccess`.
    - A head-token canonicalizer: split the leading whitespace-delimited token,
      look it up lowercased, and return the command with its head replaced when
      the lookup hits, or the input unchanged when it misses.
    - `compilePowerShellRule(inner)`: canonicalize the pattern's head token, then
      return `compilePowerShellGlob(canonicalized)`. This is the entry `index.ts`
      calls.
    - `parsePowerShellSubcommands(command)`: compute the interpolation flag with a
      regex whose alternation is `$IDENT`, `${...}`, `$(` and NOTHING else — a
      backtick must not appear in it, because in PowerShell a backtick is an
      escape character rather than command substitution. Split on the compound
      separators quote-aware, then for each piece push the piece and recurse into
      `$(...)` bodies only. Return the deduplicated list plus the flag; catch every
      internal throw and return the `ok: false` arm.
    - `powerShellSubcommandFires(glob, subcommand, hasInterpolation)`: direct
      `glob.test(subcommand)`; then canonicalize the subcommand's head and re-test
      when canonicalization changed it; then the specificity-override branch
      (`hasInterpolation && !glob.isCommandNameOnly`).

    Splitter rules, verbatim and load-bearing:
    - Separators, longest first: `&&`, `||`, then `;`, `|`, newline. A bare `&` is
      NOT a separator. There is no `|&`.
    - Single quotes open a literal region; a doubled `''` inside it is an escaped
      quote and does not close the region.
    - Double quotes: a doubled `""` is an escaped quote; a backtick inside the
      region escapes the next character.
    - Outside any quoted region a backtick escapes the next character, so a
      backtick-escaped separator does not split.
    - A backtick region is NEVER recursed into as a subcommand.
    - `$(...)` bodies ARE recursed, via a balanced-paren scan that honors quote
      state, depth-capped at 8. Exceeding the cap throws and is caught by the
      public entry, yielding the fail-open arm.
    - No wrapper stripping at all. There is no `WRAPPER_STRIP` equivalent here.

    Give the quote cursor its own advance function that reports how many
    characters it consumed (zero meaning "outside quotes, caller may inspect this
    character"), because the doubled-quote and backtick-escape cases consume two
    characters and `bash.ts`'s boolean cursor cannot express that. This is
    deliberately its own code, not a reuse of `consumeQuoteChar`. Keep the
    splitter decomposed into small named helpers the way `bash.ts` does, so both
    cognitive-complexity gates stay clear of 15 and no unit exceeds 60 lines.

    **index.ts.** Add the sixth `IfPredicate` arm
    `{ kind: "powershell"; piEvents: ReadonlySet&lt;PiToolName&gt;; psGlob: CompiledPowerShellGlob }`.
    Add the `PowerShell` branch to `compileIfPrefixForm`, reading
    `IF_PREFIX_TARGETS.PowerShell` and wrapping `compilePowerShellRule` in the
    same try / `hookDebugLog` / fall-open shape the `Bash` branch uses. Add the
    `powershell` arm to `ifFires`: guard `extractToolName(event)` against the
    predicate's `piEvents` first and return false on a miss, then extract
    `input.command` (absent -> false), then parse (`!ok` -> `hookDebugLog` +
    return true), then return true on the first subcommand that fires.

    Apply the operator-approved change to the `bash` arm in the same commit: the
    `bash` predicate gains a `piEvents` field sourced from
    `IF_PREFIX_TARGETS.Bash`, its construction site in `compileIfPrefixForm` sets
    it, and the `ifFires` bash arm gains the same tool-name membership guard ahead
    of the command extraction. Two prefixes now read `input.command`, so without
    this guard a Bash rule would fire on a PowerShell event.

    Correct every stale count and list in this file's comments so they describe
    the union as it now stands: the header's fail-open recap line that offers
    `PowerShell(...)` as its unknown-prefix example (use `Cd(...)`), the NFR-7
    paragraph's arm count, the `IfPredicate` JSDoc's arm count plus a new
    `powershell` bullet, `compileIfPredicate`'s compile-path count and its
    closed-prefix-set paragraph (the supported set gains `PowerShell`; the
    falls-open list loses it), and `compileIfPrefixForm`'s unknown-prefix example
    list. Mirror the existing `export type` / `export { ... }` re-export block for
    the new glob type, the new glob compiler, and the three `powershell.ts`
    exports.

    **Tests for this task** (the exhaustive tables are Task 2):
    - `tests/domain/components/hook-if-targets.test.ts`: add the `PowerShell` row
      to the expected-targets object in the locked position and extend the
      key-order tuple to `["Bash", "PowerShell", "Read", "Edit", "Write"]`.
    - `tests/bridges/hooks/if-field/index.test.ts`: extend
      `ExpectedIfPredicate` with the sixth arm; add `piEvents` to the bash arm
      there and to the `satisfies IfPredicate` positive-evidence literal; add a
      `powershell` positive literal and a matching `@ts-expect-error` negative;
      update the "exactly five discriminants" negative's comment to name six.
      Update the `compiles known Bash and path-tool prefixes` row expectations so
      the Bash row's `piEvents` reads `["bash"]` rather than `undefined`, and add
      a `PowerShell(Get-ChildItem *)` row. Add ONE end-to-end case proving the
      four `ifFires` outcomes listed in `<behavior>` (PowerShell fires, PowerShell
      misses, PowerShell rule on a bash event, Bash rule on a powershell event) as
      one whole compared value.
    - `tests/bridges/hooks/if-field/powershell.test.ts`: create the file with the
      minimum that proves the happy path — one `parsePowerShellSubcommands` case
      over a `;`-separated compound command, and one `powerShellSubcommandFires`
      case where a `Get-ChildItem *` rule fires on `gci foo`.

    Follow the house test conventions: `node:test`, separate lowercase
    `// arrange`, `// act`, `// assert` phases, whole-value `deepStrictEqual`
    comparisons against independently authored expectations, no phase or plan
    references in titles or comments. `HKPS-01` is an allowed anchor.
  </action>
  <verify>
    <automated>npm run typecheck && node --test "tests/domain/components/hook-if-targets.test.ts" "tests/bridges/hooks/if-field/*.test.ts" "tests/architecture/hooks-if-field.test.ts" "tests/bridges/hooks/dispatch.test.ts" "tests/bridges/hooks/event-router.test.ts"</automated>
  </verify>
  <done>
    Typecheck is clean and all five suites pass. A `PowerShell(Get-ChildItem *)`
    rule fires on a `powershell` event carrying `Get-ChildItem -Path .` and on
    `gci foo`, does not fire on `Remove-Item x`, and does not fire on a `bash`
    event; a `Bash(git *)` rule no longer fires on a `powershell` event. The
    prefix-table key order reads `Bash, PowerShell, Read, Edit, Write`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Pin the PowerShell truth tables to complete direct coverage</name>
  <files>
    tests/bridges/hooks/if-field/powershell.test.ts,
    tests/bridges/hooks/if-field/glob.test.ts,
    tests/bridges/hooks/if-field/index.test.ts,
    extensions/pi-claude-marketplace/bridges/hooks/if-field/powershell.ts,
    extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts
  </files>
  <behavior>
    - `parsePowerShellSubcommands` splits on `;`, `|`, `&&`, `||`, and newline,
      and keeps a bare `&` inside its surrounding subcommand.
    - Separators inside single quotes, inside double quotes, and after a backtick
      escape are all preserved rather than split.
    - `''` inside a single-quoted region and `""` inside a double-quoted region do
      not close the region; a backtick inside a double-quoted region escapes the
      next character.
    - A backtick-delimited region yields no nested subcommand of its own.
    - `$(...)` bodies yield nested subcommands; input nested past the cap returns
      the `ok: false` arm.
    - `timeout foo` parses to exactly `timeout foo` — nothing is stripped.
    - The interpolation flag is true for `$VAR`, `${VAR}`, `$env:PATH`, and `$(`,
      and false for a command whose only backtick is an escape.
    - `powerShellSubcommandFires` fires for alias-to-canonical, canonical-to-alias,
      and mixed-case pairings, and applies the specificity override only to a rule
      more specific than the command name.
    - `compilePowerShellGlob` reports the same metadata shape as the Bash
      compiler, matches case-insensitively, honors the `:*` sugar and the trailing
      word boundary, and reports command-name-only for `%` and `?`.
  </behavior>
  <action>
    Write the full direct-owner evidence for the new and amended modules. Every
    case owns its inputs; expectations are authored independently, never derived
    from the module under test. No shell is executed and no pwsh process is
    spawned — these are direct parser and matcher calls over literal strings.

    `tests/bridges/hooks/if-field/powershell.test.ts`, mirroring the structure and
    the title voice of `bash.test.ts` (a `describe` per exported function, one
    `test` per claim, whole-result `deepStrictEqual`):

    - Separator truth table: one command exercising `;`, `|`, `&&`, `||`, and a
      newline in source order, compared as one ordered subcommand list. A separate
      case proving a bare `&` stays inside its subcommand — that is the one
      separator Bash splits on and PowerShell does not, so it gets its own case
      rather than riding the table.
    - Quote suppression: single-quoted and double-quoted regions each containing
      every separator, plus the doubled-quote escape inside each region.
    - Backtick behavior, two claims kept apart: a backtick-escaped separator does
      not split, and a backtick-delimited region contributes no nested subcommand
      (contrast this with `bash.test.ts`'s backtick-recursion case).
    - `$(...)` recursion in discovery order, nested `$(...)` inside a quoted
      region, and the exact depth at which the cap trips versus the deepest input
      that still parses.
    - No wrapper stripping: one case over the Bash wrapper vocabulary
      (`timeout`, `time`, `nice`, `nohup`, `stdbuf`, `xargs`) proving each head is
      preserved.
    - Interpolation flag partitions per `<behavior>`.
    - Alias canonicalization through `powerShellSubcommandFires`: a canonical rule
      against alias commands (`gci`, `ls`, `dir`), an alias rule against the
      canonical command, a single-char alias (`%`), and a head that is in no alias
      row (unchanged).
    - Case-insensitivity in both directions, and the specificity-override
      partition (specific rule fires on interpolation, command-name-only rule does
      not).

    `tests/bridges/hooks/if-field/glob.test.ts`: add a `compilePowerShellGlob`
    describe block beside the existing two. Cover the metadata shape for a literal
    pattern, the case-insensitive match, the `:*` sugar normalization, the
    trailing word boundary (`Get-ChildItem *` admits bare `Get-ChildItem` and
    excludes `Get-ChildItemX`), and command-name-only detection including the `%`
    and `?` single-char heads. Assert `raw` is the unfolded caller string.

    `tests/bridges/hooks/if-field/index.test.ts`: extend the dispatch row table
    from five arms to six, and add the fall-open partition case proving an
    unknown prefix still falls open while `PowerShell(...)` no longer does. Cover
    the `powershell` arm's fail-open branch (a command nested past the recursion
    cap makes it fire) and its absent-command branch, mirroring the existing Bash
    cases. Add the compile-throw fall-open case for the PowerShell branch if the
    Bash precedent's technique transfers; if it does not, say so in the SUMMARY
    rather than inventing an unreachable input.

    Then measure. Run the direct-coverage gate on each touched pair and close any
    gap by strengthening the test, not by narrowing the source. If a branch turns
    out to be unreachable by construction, prove it (a plant that stays green),
    remove the branch when removal needs no cast and no behavior change, and
    otherwise report the shortfall by identity in the SUMMARY — do not add a
    coverage pragma and do not fabricate an impossible input.
  </action>
  <verify>
    <automated>node --test "tests/bridges/hooks/if-field/*.test.ts" && node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/if-field/powershell.ts && node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts && node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts</automated>
  </verify>
  <done>
    All three if-field suites pass and the direct-coverage gate reports complete
    line, branch, and function coverage for `powershell.ts`, `glob.ts`, and
    `index.ts` — or reports a shortfall whose identity (the exact uncovered
    branch) is recorded in the SUMMARY with the proof that it is unreachable.
  </done>
</task>

<task type="auto">
  <name>Task 3: Correct the compatibility doc and run the full gate</name>
  <files>
    docs/hooks-compatibility.md
  </files>
  <action>
    Three edits to `docs/hooks-compatibility.md`, all of them corrections of rows
    that no longer describe the bridge:

    1. In the `if` field table, split the row that currently pairs
       `PowerShell(...)` with `Cd(...)` under "falls open". `Cd(...)` keeps that
       row on its own (adjust the note to the singular). `PowerShell(<command-glob>)`
       gets a supported row placed immediately after the `Bash(<command-glob>)`
       row, marked supported on both sides, with a note covering: compound split
       on `;` `|` `&&` `||`, the `:*` suffix, case-insensitive matching,
       alias canonicalization, and that no process wrappers are stripped.
    2. In the Pi-tool-name mapping table under "Tool name mapping", add the
       `powershell` / `PowerShell` row after `bash`. That mapping has shipped in
       `hook-tool-names.ts` since the identity mapping landed; the table simply
       never listed it.
    3. The `if` field table already carries per-mechanic Bash rows (compound
       split, wrapper strip). Add the parallel PowerShell mechanic rows beside
       them: one for the separator set, naming that a bare `&` is not a separator
       and that backticks escape rather than substitute; one for alias
       canonicalization and case-insensitive matching.

    Re-read the surrounding prose for anything the change falsifies — in
    particular the "Silent fall-open" bullet list near the bottom and the
    "Unmapped Claude tools" paragraph under the tool-name table. Correct only what
    is now untrue; leave the rest byte-identical.

    Match the file's existing table conventions exactly: escaped `\|` inside
    cells, the same `✓` / `✗` / `⚠` legend, and the alignment style mdformat
    produces. Write the notes in plain, direct English consistent with the
    surrounding rows.

    Then run the full gate and the pre-commit pipeline. `docs/*.md` goes through
    mdformat and markdownlint under pre-commit, not prettier, so a clean
    `npm run check` is not evidence the doc is formatted — run the hooks over the
    changed paths as well. If `npm run check` short-circuits at `format:check` on
    a file unrelated to this change, run its members separately and check each
    exit code rather than treating the short-circuit as a pass.
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>
    `npm run check` is green end to end — typecheck, lint, all three fallow
    sub-gates, format:check, both corresponding-test gates, the direct-coverage
    negative control, the unit suite, and the integration suite. The
    compatibility doc lists `PowerShell(...)` as supported, lists `powershell` in
    the tool-name table, and leaves `Cd(...)` in the falls-open row.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin author -> `if` field | A plugin's `hooks.json` supplies the rule pattern string that reaches `compilePowerShellRule`. Untrusted, attacker-authored in the worst case. |
| model / user -> `input.command` | The runtime PowerShell command text the matcher parses. Model-generated, so effectively untrusted input crossing into the parser. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-qqo-01 | Denial of Service | `parsePowerShellSubcommands` `$(...)` recursion | medium | mitigate | Depth cap of 8, identical to `bash.ts`. Exceeding it throws, is caught at the public entry, and returns the fail-open arm. Task 2 pins the exact cap boundary. |
| T-qqo-02 | Denial of Service | `compilePowerShellGlob` matching | medium | mitigate | No regex is compiled from user input and there is zero alternation. Matching reuses the existing `matchTokens` recursive descent whose complexity envelope is already documented in `glob.ts`; the lower-case fold adds one linear pass. |
| T-qqo-03 | Tampering | a crafted command that evades the matcher | low | accept | The `if` field is documented upstream as best-effort and explicitly not a security boundary (D-61-02). A hand-authored parser will diverge from pwsh's real AST on exotic input. Every uncertain path falls OPEN — the hook fires — so an evasion costs an extra fire, never a missed one. |
| T-qqo-04 | Elevation of Privilege | `Bash(...)` firing on a `powershell` event | medium | mitigate | Both command-bearing prefixes now guard `event.toolName` against their own `piEvents` set before reading `input.command`. Pinned by the Task 1 cross-fire cases in both directions. |
| T-qqo-05 | Information Disclosure | alias table transcription | low | mitigate | The table is transcribed verbatim from the captured upstream artifact and reviewed against it; a wrong row changes which rules fire, so Task 2 pins alias behavior through the public matcher. |

No package-manager installs occur in this plan — the D-61-01 zero-new-deps
stance holds and the package-legitimacy gate has no target here.
</threat_model>

<verification>
- `npm run check` green end to end.
- `tests/bridges/hooks/if-field/powershell.test.ts` exists at the mirrored path,
  so `test:corresponding` passes with the new module.
- Direct coverage complete (or shortfall recorded by identity) for
  `powershell.ts`, `glob.ts`, and `index.ts`.
- `tests/architecture/hooks-if-field.test.ts` and
  `tests/bridges/hooks/dispatch.test.ts` pass unedited.
- No `process.platform` read on any touched path.
- No comment in any touched file carries a phase, plan, wave, or milestone
  reference, and no comment narrates code that no longer exists.
</verification>

<success_criteria>
A hook whose handler declares `if: "PowerShell(Get-ChildItem *)"` fires on a Pi
`powershell` tool event for `Get-ChildItem`, `gci`, `ls`, `dir`, and any casing
of those, does not fire for `Remove-Item`, does not fire on a `bash` event, and
falls open on anything the parser cannot decide. A `Bash(...)` rule stops firing
on `powershell` events. The compatibility doc says so. The full gate is green.
</success_criteria>

<output>
Create `.planning/quick/260907-qqo-hkps-01-if-field-powershell-rule-prefix-/260907-qqo-SUMMARY.md` when done.
</output>

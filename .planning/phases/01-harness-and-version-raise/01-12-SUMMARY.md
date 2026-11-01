---
phase: 01-harness-and-version-raise
plan: 12
subsystem: domain
tags: [argument-substitution, tokenizer, tree-sitter-bash, claude-code-parity, tdd]

requires:
  - phase: 01-harness-and-version-raise
    provides: "plan 01-10's fallow dynamicallyLoaded + ignoreExports entries for domain/shell-words.ts and domain/argument-substitution.ts"
provides:
  - "splitArguments(text): the Claude Code 2.1.316 c$o / Ck argument tokenizer port (D-CF1-01)"
  - "substituteArguments(input): the T2e port with FZt variables, the xM bang guard, m1t value wrapping, and the 4,000,000-character cap (D-CF1-01)"
  - "parseArgumentNames(frontmatterArguments): the Rhe port, declared order kept"
  - "claudeEffort(thinkingLevel) and ClaudeEffort: Pi thinking level to ${CLAUDE_EFFORT}"
  - "InvocationTooLargeError with readonly size and limit"
affects: [skills bridge, commands bridge, skill aliases, command invocation, context injection]

actuals:
  tokens: 12925
  tasks: 3
  commits: 3
plan_head_before: 9a815c57e5be80e7c6c7ca4df70dbebe7f7bb60c
plan_head_after: 53d81ec2c8b6dee002a553ee571e50b75e4bc816

tech-stack:
  added: []
  patterns:
    - "A hand-written cursor scanner with one function per token kind keeps every function under both complexity gates"
    - "Nested quote and bracket scanning uses an explicit stack, so input depth cannot overflow the call stack"
    - "Tokenizer parity is checked against a tree-sitter-bash 0.25.1 re-run of Claude Code's Ck in the session scratchpad; the test module carries the verified rows as literals"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/shell-words.ts
    - test/domain/shell-words.test.ts
    - extensions/pi-claude-marketplace/domain/argument-substitution.ts
    - test/domain/argument-substitution.test.ts
  modified: []

key-decisions:
  - "parseArgumentNames keeps the declared order; the 64-name and 64-character limits and the longest-first sort run inside substituteArguments, as in T2e, so name i still reads argument i"
  - "The size cap is checked only when a value is filled in or appended, as upstream does; an oversized body with nothing substituted is returned as is"
  - "An unclosed quote keeps the words before it (upstream error recovery), so 'fix the bug that doesn't work' gives fix, the, bug, that, doesn, matching Claude Code"
  - "All 39 research golden vectors match, including the compound-statement rows and --flag=1 -v; the residual table holds fuzz-found differences instead"

patterns-established:
  - "Golden, upstream, and residual row tables: a residual row asserts the port's own output and names upstream's in its title"

requirements-completed: [DEC-01]

coverage:
  - id: D1
    description: "splitArguments reproduces c$o: empty text gives no words, text over 10,000 characters takes the whitespace split, only the first simple command counts, and all 39 research golden vectors match"
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/domain/shell-words.test.ts#D-CF1-01: splits <text> into <tokens> (golden and upstream rows)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/shell-words.ts"
        status: pass
      - kind: other
        ref: "scratchpad compare.mjs over 20,000 generated well-formed quoting and escape inputs without $: 0 differences from tree-sitter-bash 0.25.1"
        status: pass
    human_judgment: false
  - id: D2
    description: "substituteArguments follows T2e: escapes, named, indexed, positional, and raw passes, the append rule, value wrapping, variables in body and values, the bang guard, and the 4,000,000-character cap with InvocationTooLargeError"
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/domain/argument-substitution.test.ts#substituteArguments"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/argument-substitution.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "parseArgumentNames ports Rhe and claudeEffort maps the Pi thinking levels to Claude effort levels"
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/domain/argument-substitution.test.ts#parseArgumentNames and #claudeEffort"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both modules import only the sibling shell-words module, pass both complexity gates, dead code, and duplication"
    requirement: DEC-01
    verification:
      - kind: other
        ref: "npx fallow health --fail-on-issues --format human --quiet --complexity"
        status: pass
      - kind: other
        ref: "npx fallow dead-code --fail-on-issues --format human --quiet"
        status: pass
      - kind: other
        ref: "npx fallow dupes --fail-on-issues --format human --quiet"
        status: pass
    human_judgment: false

duration: 43min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 12: Argument Substitution Core Summary

**A pure port of Claude Code 2.1.316's argument substitution: a hand-written tree-sitter-bash first-command tokenizer that matches all 39 golden vectors and 20,000 fuzzed well-formed quoting inputs, and the full T2e pass chain with variables, the `!` guard, value wrapping, and the 4,000,000-character cap.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-11-01T02:59:23Z
- **Completed:** 2026-11-01T03:42:36Z
- **Tasks:** 3
- **Files modified:** 4 (all created)

## Accomplishments

- `splitArguments` ports `c$o`/`Ck`/`Twe`/`Vst`/`pe`. It reads the first simple command, with quoting, backslash escapes, expansions, substitutions, control operators, redirections, assignments, comments, and the compound openers `Ck` reads through. All 39 inputs of the research golden table match, the 9 compound-statement and error-recovery inputs included.
- `substituteArguments` ports `T2e` with the `FZt` variable pass, `xM`, and `m1t`. `parseArgumentNames` ports `Rhe`. `claudeEffort` maps the thinking level. `InvocationTooLargeError` uses Claude Code's message word for word.
- I checked parity against a tree-sitter-bash 0.25.1 re-run of `Ck` (the research harness in the session scratchpad). There were 0 differences on 20,000 generated well-formed inputs that mix plain words, `'…'`, `"…"` with escapes, and `\x` escapes. The differences that remain come from `$`-expansion lexing quirks and from error recovery after an unclosed quote.

## Final exported signatures (for the skills and commands phases)

```ts
// domain/shell-words.ts
export function splitArguments(text: string): readonly string[];

// domain/argument-substitution.ts
export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";
export class InvocationTooLargeError extends Error {
  readonly size: number;
  readonly limit: number; // 4_000_000
  constructor(size: number);
}
export interface ArgumentSubstitution {
  readonly body: string;
  readonly args: string | undefined;
  readonly argumentNames: readonly string[];
  readonly variables: Readonly<Record<string, string>>;
  readonly append?: boolean; // default true
}
export function substituteArguments(input: ArgumentSubstitution): string;
export function parseArgumentNames(frontmatterArguments: unknown): readonly string[];
export function claudeEffort(thinkingLevel: string | undefined): ClaudeEffort;
```

`variables` keys that are read: `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_SKILL_DIR`, `CLAUDE_SESSION_ID`, `CLAUDE_EFFORT`, filled in that order. Any other key is ignored. A missing key leaves its `${...}` literal. Callers pass `argumentNames: parseArgumentNames(frontmatter.arguments)` unchanged.

## Task Commits

1. **Task 1: Substitute positional arguments through a first tokenizer, end to end**: `f2612fb` (feat)
2. **Task 2: Port the first-simple-command grammar against the golden vectors**: `4ff6602` (feat)
3. **Task 3: Complete T2e: escapes, named arguments, value wrapping, variables, the cap, and effort**: `53d81ec` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## TDD Gate Compliance

`workflow.tdd_mode` is false. Each task's RED step ran but has no commit of its own. A test-only commit cannot pass the pre-commit hook (`check:commit` runs the staged pair's coverage). The project's commit rules also forbid the `test(01-12)` scope form. The RED evidence (output kept in the agent scratch folder):

- **Task 1 RED:** stub modules (`splitArguments` returning `[]`, `substituteArguments` returning the body). 14 tests, 8 failed on `assert.deepStrictEqual`/`strictEqual` for the planned values. Semantic check: each target test ran and failed on its planned assertion. No load failure.
- **Task 2 RED:** the new 116-test module ran against the committed Task 1 tokenizer. 87 failed on token-list assertions (quoting, operators, redirections, expansions). The 29 that passed are plain-word rows that the Task 1 scanner already handled.
- **Task 3 RED:** stubbed `parseArgumentNames`/`claudeEffort`/`InvocationTooLargeError` with the Task 1 substitution. 52 tests, 29 failed on the escape, named, variable, cap, parser, and effort assertions.
- **GREEN:** every task commit passed its tests, 100% direct coverage (lines, functions, branches), and the commit hook.

## Residual list (D-CF1-01 licensed residual, for the PROJECT.md check)

No golden vector is a residual. Known differences from tree-sitter-bash 0.25.1, each a row of `RESIDUAL_ROWS` in `test/domain/shell-words.test.ts`:

| Input | Port | Upstream |
|----|----|----|
| `a ${b c` | `["a"]` | `["a","c"]` |
| `_=1 b` | `["b"]` | `["_=1","b"]` |
| `x 'a'\$ y` | `["x","a","$","y"]` | `["x","a","y"]` |
| `!{ b` | `["!{","b"]` | `["{","b"]` |
| `) a b` | `["a","b"]` | `["b"]` |
| `[ ( ]; b c` | `["b","c"]` | `["]"]` |
| `for x in (y); do a b; done` | `["a","b"]` | `["y"]` |
| `$@-$1` | `["$@-$1"]` | `["$@-$","1"]` |
| `ab"a\"` | `["ab\"a\\\""]` | `["aba\\"]` |

The residual classes are:

1. `$` followed by digits inside a concatenation after certain pieces. Upstream sometimes splits `…$1` into `…$` and `1`.
2. A lone `\$` word right after a quoted piece.
3. Error recovery after an unclosed quote, `${`, or bracket. The port follows the main upstream patterns: the words before it are kept, and a mid-word unclosed `"` is kept raw.
4. Odd compound forms (`!{`, a stray leading `)`, `(` inside `for … in`).

On a random alphabet weighted toward quotes and backslashes, about 1% of inputs still differ. All of them have unbalanced quotes.

Substitution residuals, written in the module documentation:

- Pi writes `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_SKILL_DIR}`, and `${CLAUDE_PROJECT_DIR}` into the body at install, so the `$` passes read a path that holds `$1` or `$ARGUMENTS`. Upstream wraps these paths.
- `${user_config.*}` stays literal.
- Frontmatter `effort` does not drive `${CLAUDE_EFFORT}` (D-CF1-05).

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/shell-words.ts`: the `c$o`/`Ck` tokenizer port.
- `test/domain/shell-words.test.ts`: 39 golden rows, 65 more upstream-verified rows, 9 residual rows, plus the 10,000-character limit and deep-nesting cases.
- `extensions/pi-claude-marketplace/domain/argument-substitution.ts`: `T2e`, `Rhe`, the effort mapping, and the error class.
- `test/domain/argument-substitution.test.ts`: one case per pass and rule (52 cases).

## Decisions Made

- `parseArgumentNames` returns names in declared order. The `T2e` steps (drop names over 64 characters keeping the original index, keep the first 64, sort longest first) run inside `substituteArguments`. That is where upstream runs them.
- The cap check runs only when a value is inserted. So the plan's "4,000,001-character body with `args: ""` throws" case is written as a 4,000,001-character body that ends in `$ARGUMENTS`. A separate case shows that an oversized body with nothing substituted passes through, as upstream does.
- With `args: undefined`, the variables are still filled (`T2e` runs the body transform with identity wrapping), as the plan's must-have says. CONTEXT E1's "returned unchanged" leaves out the variable pass.
- `variables` is applied only for the six `FZt` names, in `FZt` order. Tests pin the order and the literal pass-through for any other name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] parseArgumentNames does not sort or cut**
- **Found during:** Task 3
- **Issue:** The plan's interface and behavior rows said `parseArgumentNames` cuts to 64 names of 64 characters and sorts them longest first (`"long short"` gives `["short","long"]`). In the binary, `Rhe` only filters. `T2e` cuts and sorts while it keeps each name's original index, because name `i` reads argument `i`. A sorted list passed to `substituteArguments` would bind `$short` to argument 0.
- **Fix:** `parseArgumentNames` keeps the declared order. The cut and sort happen in `substituteArguments`. Tests cover the declared-index mapping, the over-64-character skip that keeps later indexes, the 64-name limit, and longest-first matching.
- **Files modified:** `domain/argument-substitution.ts`, `test/domain/argument-substitution.test.ts`
- **Commit:** `53d81ec`

**2. [Rule 1 - Bug] Size-cap test input**
- **Found during:** Task 3
- **Issue:** The plan's row "a body of 4,000,001 characters with `args: ""` throws" does not hold upstream. `T2e` checks the size only inside the value function `w`.
- **Fix:** The throwing case is a 4,000,001-character body that holds `$ARGUMENTS`. A separate case covers an oversized body with nothing substituted.
- **Commit:** `53d81ec`

**3. [Rule 2 - Missing critical] Stack-safe nesting scan (T-01-20)**
- **Found during:** Task 2
- **Issue:** A first recursive scan of `"$(` nesting overflowed the call stack at about 3,000 levels, which is reachable within the 10,000-character parse limit. That is a denial-of-service crash.
- **Fix:** The scan now keeps an explicit stack. The case `x` + `"$(` × 3,000 is covered by a test.
- **Commit:** `4ff6602`

**4. [Rule 1 - Bug] Test expectations in Task 1 for missing indexes**
- **Found during:** Task 1
- **Issue:** My first `$5` and `$ARGUMENTS[9]` expectations left out the upstream append that happens when nothing was substituted.
- **Fix:** Each of those cases now also substitutes `$0`, so it tests only the literal-index rule.
- **Commit:** `f2612fb`

---

**Total deviations:** 4 auto-fixed (3 Rule 1, 1 Rule 2)
**Impact on plan:** Each fix moves closer to the binary's behavior or closes a crash. No signature in the plan's interface changed. Only the documented behavior of `parseArgumentNames` changed.

## Issues Encountered

- The worktree guard refuses heredocs and compound commands that name paths in some ways. I used scripts in the agent scratch folder instead.

## Known Stubs

None.

## Threat Flags

None. No security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-18 (bang guard), T-01-19 (no re-substitution), and T-01-20 (the cap, the 10,000-character limit, and the stack-safe scan) are each covered by tests.

## User Setup Required

None. No external service configuration is required.

## Dubious Choices

1. **Tokenizer parity oracle.** Parity was measured against tree-sitter-bash 0.25.1 through the research re-implementation of `Twe`/`Vst`/`pe`/`an`. That this equals the grammar bundled in Claude Code 2.1.316 is an assumption carried over from the research ("ASSUMED that Claude bundles an equivalent grammar").
2. **Error-recovery modeling.** I ported several tree-sitter error-recovery patterns: words before an unclosed quote are kept; a mid-word unclosed `"` is kept raw unless it is the lone second piece, ends in a dangling backslash, or holds `$(` or a backtick; a stray `)` outside a subshell is skipped; a `--name=` word is read as an assignment; keywords glued to a quote or `$` count as keywords. They are inferred from probes, not from grammar source. They match every probe I ran, but they are heuristics.
3. **`parseArgumentNames` contract** differs from the plan's interface text (declared order instead of longest first). See deviation 1. The skills and commands phases must pass its result to `substituteArguments` unchanged.
4. **Size-cap test** differs from the plan's literal row. See deviation 2.
5. **`variables` typing** stays `Readonly<Record<string, string>>`, per the plan, not a closed key union. An unknown key is ignored without an error.
6. **No separate RED commits.** The hook and the commit-scope rules prevent them. The RED evidence is recorded above.

## Next Phase Readiness

- The skills phase can wire `substituteArguments` into `edge/skill-aliases.ts`. The commands phase can wire it into `edge/command-invocation.ts`. Both build `variables` from the Pi session id and `claudeEffort(pi.getThinkingLevel())`.
- Plan 01-10's `ignoreExports` entries can be removed once both phases import these modules.

## Self-Check: PASSED

All four created files exist. Commits `f2612fb`, `4ff6602`, `53d81ec`, and the SUMMARY commit are on the branch. Every task's acceptance greps print the expected counts.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*

---
phase: 01-harness-and-version-raise
reviewed: 2026-11-01T06:56:01Z
depth: standard
iteration: 2
files_reviewed: 8
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/shell-words.ts
  - extensions/pi-claude-marketplace/platform/prompt-shell.ts
  - features/step_definitions/companion.steps.ts
  - features/step_definitions/mcp-server/calls.steps.ts
  - test/architecture/behavioral-shard-coverage.test.ts
  - test/domain/shell-words.test.ts
  - test/platform/prompt-shell.test.ts
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 1: Code Review Report (iteration 2)

**Reviewed:** 2026-11-01T06:56:01Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This pass re-reviews the fix commits `7168ed8..HEAD` (f9e7659, c1c71bc, 752ba55,
ea45db2, 954f329). It checks that iteration 1's WR-01..WR-05 are resolved, and it
looks for regressions those commits introduced.

Resolution status:

- **WR-01 (`\$` after a quoted piece or expansion): resolved for the stated class,
  with one regression.** I re-ran the fixer's oracle sets against HEAD with the
  research harness (tree-sitter-bash 0.25.1, `scripts/ck2.mjs`). The 28,270 gen2
  inputs show 0 regressions and 892 fixes. The 10 remaining differences are the
  two recorded `\$)` / `\$(` residual rows. The 36,000 punctuation inputs show 0
  regressions. I also built a wider context grid: 53,248 inputs, made of 16
  prefixes x 16 preceding pieces x `\$` x 30 following characters x 7 tails.
  It found 3,762 inputs fixed and **480 regressed**. Every regressed input has a
  glued assignment value before the `\$` (see WR-01 below).
- **WR-02 (declared `shell: bash` with no Git Bash): resolved.** `selectPromptShell`
  returns `{ kind: "bash-missing" }` only for `requested === "bash"` when Bash is
  unavailable. The PowerShell-flag branch fires only for `requested === "powershell"`,
  so the flag cannot rescue a declared bash. That matches upstream's outcome.
  I checked the message fragments in `/opt/claude-code/bin/claude`:
  ` requires bash (\`shell: bash\` in frontmatter) but Git Bash was not found. `,
  `U0 = \`Install ${$We}\``, `$We="Git for Windows (https://git-scm.com/downloads/win)"`,
  and `, or change the skill's frontmatter to \`shell: powershell\`.`.
  They join to `bashMissingMessage`'s text. No production caller exists yet, so the
  return-type change breaks nothing.
- **WR-03 (CI shards can drop a directory): resolved.** The new architecture test
  runs in `test:unpaired`. It parses both the inline and the folded `>-` `paths`
  forms, and it fails when a feature file is in zero shards or in two. It passes
  on the current tree. It also fails loudly on a trailing-slash or file-path shard
  entry, which is the safe direction.
- **WR-04: resolved.** The launch-environment step now takes `PROFILE_PI_START_TIMEOUT_MS`.
- **WR-05: resolved.** `UNTRUSTED_START_TIMEOUT_MS = 2 * PROFILE_PI_START_TIMEOUT_MS`.
  `usePiWithProfile` and `PiProcess.start` set no shorter inner start timeout, so
  the step budget governs.

ESLint (`--max-warnings 0`) is clean on all eight files. The three paired test
modules pass (174 tests).

## Warnings

### WR-01: `skipBareDollar` drops the `\$` after a glued assignment value; upstream keeps it as the command name (regression from f9e7659)

**File:** `extensions/pi-claude-marketplace/domain/shell-words.ts:449-450` (`readCommandItem`), with `skipBareDollar` at lines 324-335
**Issue:** `readCommandItem` calls `skipBareDollar` after every word, including an
assignment word (`NAME=<quoted piece or expansion>`) that comes before the
command name. tree-sitter-bash does not drop the `\$` there. The `\$` reads as a
word, and `Vst` emits it as the command name `$`. The port before f9e7659 matched
upstream on these inputs. The new port skips the `\$`, so the next word becomes
the command name, and every later `$N` shifts by one. This is a backslash-escape
case, which D-CF1-01 requires to match exactly. Results from the oracle
(`ck2.mjs`, tree-sitter-bash 0.25.1):

| typed | upstream | HEAD | before f9e7659 |
|---|---|---|---|
| `x="a"\$ b c` | `["$","b","c"]` | `["b","c"]` | `["$","b","c"]` |
| `x='a'\$ b` | `["$","b"]` | `["b"]` | `["$","b"]` |
| `x=$X\$ b` | `["$","b"]` | `["b"]` | `["$","b"]` |
| `x=b"a"\$ b` | `["$","b"]` | `["b"]` | `["$","b"]` |
| `x="a"\$` | `["$"]` | `["x=\"a\"\\$"]` (whitespace fallback) | `["$"]` |

The grid has 480 regressions, and all of them have this shape: a value ending in
a quoted piece or an expansion (`"a"`, `'a'`, `$X`, `${X}`, `$'a'`, `$"a"`,
`` `c` ``, `$(c)`, `$((1))`, `$1`, `$@`, `b"a"`) glued after `x=`, then `\$`,
then a blank, a newline, a `"`, or the end of the text. No other prefix regressed: argument
position, command-name position, `x=1 ` followed by a name, here-strings,
redirects, `[`, `for`, `{`, `!`, `if`, and `|` were all checked. The new tests
include no assignment row, so they cannot catch this.

**Fix:** Skip only after a word that is not an assignment before the command name:

```ts
const word = readWord(cursor);
if (command.named || !ASSIGNMENT.test(word.raw)) {
  skipBareDollar(cursor, word);
}
```

I checked this patch on a copy (`rr2/sw-patched.ts` in the session scratchpad)
against the same 53,248-input grid. It has 0 regressions and keeps all 3,762
fixes. Then add the first four rows above to `UPSTREAM_ROWS` as they came from
the oracle.

## Info

### IN-01: The residual table omits frequent residual classes on natural-language arguments

**File:** `extensions/pi-claude-marketplace/domain/shell-words.ts:8-12` (residual policy); `test/domain/shell-words.test.ts:147-158`
**Issue:** Carried forward from iteration 1. The fixes changed the table's rows
but did not add these classes. Line numbers are updated. D-CF1-01 licenses the
grammar residuals, but the residual table lists only exotic examples. The
differential run shows common phrases that differ: `100% coverage now` (upstream
`["coverage","now"]`, port `["100%","coverage","now"]`), `50% off`, `run == check`
(upstream drops `==`), `{x} y`, `! [x]`, `{ b`, and `a= b`. These made up about
11% of a 2,885-input sample of mixed punctuation. `%`-led arguments and `==` are
plausible in real `/cmd` arguments.
**Fix:** Add representative rows (`100% coverage`, `a == b`, `{x} y`) to
`RESIDUAL_ROWS` so the licensed difference is recorded. Or port tree-sitter's
handling where it is cheap (a `%`-led first word, `==` arguments).

### IN-02: Whole-file fallow export suppressions for six cores have no removal trigger

**File:** `.fallowrc.json:5-26`; `extensions/pi-claude-marketplace/platform/pi-api.ts:77-82`
**Issue:** Carried forward unchanged from iteration 1. `dynamicallyLoaded` plus
`ignoreExports: ["*"]` covers six modules, and two `fallow-ignore-next-line unused-type`
markers cover the new Pi types. Together they turn off dead-code detection for
every export of the invocation cores. This now also covers the new
`PromptShellChoice` and `bashMissingMessage` exports. The cores are not wired yet,
so this is intended. But nothing forces the suppressions out when Phases 2 and 3
wire the cores.
**Fix:** Have the Phase 2/3 plans delete each module's entry when they import it,
or narrow `exports` to the named symbols each phase is expected to consume.

### IN-03: The exact `pi-ai` dev pin can diverge from the copy `pi-coding-agent` pins

**File:** `package.json:19-21`
**Issue:** Carried forward unchanged from iteration 1. `@earendil-works/pi-ai` is
pinned exactly to `1.4.0` for the scripted model. `@earendil-works/pi-coding-agent`
is `^1.4.0`, and each of its releases depends on an exact `pi-ai` version. After a
lockfile refresh to pi-coding-agent 1.5.x, the harness would run against two
pi-ai copies.
**Fix:** Pin `@earendil-works/pi-coding-agent` exactly in `devDependencies`. Or give
`pi-ai` the same caret range and add an `npm ls @earendil-works/pi-ai` dedupe check
to `check:static`.

### IN-04: A `!` command that leaves a background child holding stdout open runs to the 120 s timeout

**File:** `extensions/pi-claude-marketplace/platform/prompt-shell.ts:363-367`
**Issue:** Carried forward from iteration 1. The content is unchanged. The line
numbers moved because c1c71bc added code above. The run settles on `close`, which
waits for every holder of the stdout and stderr pipes. A command like
`` !`some-server &` `` exits its shell right away, but the background child keeps
the pipe open. The invocation then blocks for two minutes and aborts as
"interrupted". Upstream's behavior here is unverified.
**Fix:** If upstream returns when the shell exits, settle on `exit` and give the
streams a short drain window. Otherwise, record this under D-CF1-02's residuals.

### IN-05: A lone `$` followed by `\$<char>` still differs from upstream and is not recorded

**File:** `extensions/pi-claude-marketplace/domain/shell-words.ts:324-335`; `test/domain/shell-words.test.ts:147-158`
**Issue:** This mismatch existed before f9e7659; the fix commits did not cause it.
The fix report says only two error-recovery classes still differ. The wider grid
finds a third class with well-formed quoting: a lone `$` followed by `\$`.

| typed | upstream | port |
|---|---|---|
| `x $\$5 y` | `["x","$\\$5","y"]` | `["x","$5","y"]` |
| `x $\$a b` | `["x","$\\$a","b"]` | `["x","$a","b"]` |
| `$\$ b` (name position) | `["$","b"]` | `["$","$","b"]` |
| `$\$$X b` | `["$$X","b"]` | `["$","$$X","b"]` |

The added row `x $\$ b` -> `["x","$","b"]` matches upstream only in argument
position, before a blank. This may fall under the module header's "some `$`
lexing" best-effort clause rather than D-CF1-01's escape carve-out. That is why
it is Info here. Either way, it is undocumented.
**Fix:** Add two oracle-checked rows to `RESIDUAL_ROWS` (`x $\$5 y` and `$\$ b`),
or port the lone-`$` case.

---

_Reviewed: 2026-11-01T06:56:01Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

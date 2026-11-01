---
phase: 01-harness-and-version-raise
fixed_at: 2026-11-01T06:50:39Z
review_path: .planning/phases/01-harness-and-version-raise/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-11-01T06:50:39Z
**Source review:** .planning/phases/01-harness-and-version-raise/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01..WR-05; fix scope `critical_warning`, so IN-01..IN-04 were not attempted)
- Fixed: 5
- Skipped: 0

**Where verification ran:** in the main checkout `/home/user/pi-claude-marketplace`
(branch `claude/quirky-planck-hhm592`), not in an isolated worktree. Each commit
went through the normal pre-commit hook, which ran `npm run check:commit` and
passed. The root-sandbox wrapper (`npm_config_script_shell=.../nondac-sh`,
`NODE_OPTIONS=--max-old-space-size=6144`) was set for every npm script and commit.

## Fixed Issues

### WR-01: `\$` after a quoted piece or expansion tokenizes differently from upstream

**Files modified:** `extensions/pi-claude-marketplace/domain/shell-words.ts`, `test/domain/shell-words.test.ts`
**Commit:** f9e7659
**Status:** fixed: requires human verification (tokenizer logic)
**Applied fix:** A new `skipBareDollar` runs after each word that `readCommandItem`
reads. When the word's last piece is not unquoted text and is not a lone `$`, and
the text continues with `\$` followed by a blank, a double quote, a newline, or
the end of the text, the port skips that `\$`. tree-sitter-bash reads it there as
a bare `$` token, and `Vst` drops that token. A quoted piece after it becomes a
word of its own. Two context rules came from the oracle and differ from the
reviewer's sketch. The skip also runs for a here-string target once the command
has a name (`x <<< "a"\$ b` gives `["x","b"]`). It does not run for a redirect
target before the command name (`> "a"\$ b` gives `["$","b"]`). After a lone `$`,
the `\$` stays a word (`x $\$ b` gives `["x","$","b"]`).

Oracle: the research harness `scripts/ck.mjs` / `ck2.mjs` (tree-sitter-bash 0.25.1)
in the session scratchpad.
- The reviewer's generator (`gen2.mjs`: quotes, backslashes, `$X`/`${X}`, words)
  produced 7 random batches, 28,000 inputs in all. Before the fix, 124 inputs per
  4,000 differed. After the fix, 0 differ.
- A wider punctuation generator (redirects, `;`, `(`, `)`, keywords, `$(...)`,
  newlines) produced 9 batches, 36,000 inputs. Old and new ports were compared with
  upstream: 0 regressions, and about 25 inputs fixed per 4,000.
- A 270-input context grid placed `\$` after each piece kind, before about 30
  following characters. Only two error-recovery classes still differ, and both are
  recorded as residual rows:
  - `x "a"\$)b c`: a `)` inside a word. It is the general `)`-recovery residual,
    since `x a)b c` differs the same way.
  - `"a"\$(b) c`: `\$(` in command-name position, which tree-sitter turns into an
    ERROR node.

Test changes:
- 12 oracle-checked rows joined `UPSTREAM_ROWS`, including the reviewer's five
  inputs.
- `x 'a'\$ y` moved from `RESIDUAL_ROWS` to `UPSTREAM_ROWS`.
- The two error-recovery residuals above joined `RESIDUAL_ROWS`.
- Direct coverage stays 100% (225/225 branches), and fallow health passes.

### WR-02: Explicit `shell: bash` on Windows without Git Bash silently runs PowerShell

**Files modified:** `extensions/pi-claude-marketplace/platform/prompt-shell.ts`, `test/platform/prompt-shell.test.ts`
**Commit:** c1c71bc
**Applied fix:** `selectPromptShell` now returns a discriminated
`PromptShellChoice`:
- `{ kind: "shell", shell }` when a shell can run.
- `{ kind: "bash-missing" }` when the frontmatter declares `shell: bash` and Bash
  is unavailable (Windows without Git Bash).

The order follows upstream `HRe`. The refusal is checked before the PowerShell
flag, so `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` does not rescue a declared
`shell: bash`. A new `bashMissingMessage(invocation)` returns upstream's text. I
found that text in `/opt/claude-code/bin/claude` 2.1.316, in `HRe`. `U0` is
`` `Install ${$We}` `` and `$We` is `"Git for Windows (https://git-scm.com/downloads/win)"`:

> Skill /<name> requires bash (`shell: bash` in frontmatter) but Git Bash was not found. Install Git for Windows (https://git-scm.com/downloads/win), or change the skill's frontmatter to `shell: powershell`.

Upstream says "Skill" for commands too. It passes `` `/${e}` `` as the name. It
throws at the top of `HRe`, before it scans for `!` patterns, so a body with no
`!` commands also fails. The doc comment records this so that the Phase 2 and
Phase 3 wiring can match it. Tests cover the refusal with and without the
PowerShell flag, and assert the exact message text. Direct coverage is 100%
(86/86 branches). The module is not wired to any user path yet, so this change
needs no cucumber scenario.

### WR-03: CI behavioral shards list directories, so a new feature directory silently drops out of CI

**Files modified:** `test/architecture/behavioral-shard-coverage.test.ts` (new), `.github/workflows/ci.yml` (comment only), `.agents/skills/cucumber/rules/world-and-stand-ins.md`
**Commit:** 752ba55
**Applied fix:** A new architecture test runs in `test:unpaired`, so the commit
hook and CI both run it. It reads the `behavioral` job's matrix `paths` from
`ci.yml`, both the inline form and the folded `>-` form. It fails when a
`features/**/*.feature` file is in no shard, or in two. To keep it from passing
on nothing, it also asserts that the workflow names at least one shard and that
`features/` holds at least one feature file. The shard shape from D-CF1-16 did
not change. A manual negative control (a temporary `features/command/tmp.feature`,
deleted afterward) made the test fail. The ci.yml comment and the cucumber skill's
CI rule now name the gate.

### WR-04: The launch-environment profile-Pi step runs under the 30-second default timeout

**Files modified:** `features/step_definitions/mcp-server/calls.steps.ts`
**Commit:** ea45db2
**Applied fix:** The step now passes `{ timeout: PROFILE_PI_START_TIMEOUT_MS }`,
imported from `features/support/world.ts`. `npx cucumber-js features/mcp-server`
passed: 3 scenarios.

### WR-05: The untrusted start has a shorter timeout than the trusted start

**Files modified:** `features/step_definitions/companion.steps.ts`
**Commit:** 954f329
**Applied fix:** `UNTRUSTED_START_TIMEOUT_MS = 2 * PROFILE_PI_START_TIMEOUT_MS`
(180 s), and the comment now gives the reason. The two untrusted-project
scenarios passed.

---

_Fixed: 2026-11-01T06:50:39Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

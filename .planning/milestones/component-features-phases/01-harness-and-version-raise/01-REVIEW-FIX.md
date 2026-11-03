---
phase: 01-harness-and-version-raise
fixed_at: 2026-11-01T07:05:56Z
review_path: .planning/phases/01-harness-and-version-raise/01-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-11-01T07:05:56Z
**Source review:** .planning/phases/01-harness-and-version-raise/01-REVIEW.md (iteration-2 review)
**Iteration:** 3

**Summary:**
- Findings in scope: 2. WR-01 is in scope under `critical_warning`. The orchestrator added IN-05, because D-CF1-01 requires backslash escapes to match exactly. IN-01..IN-04 were left alone, as the orchestrator directed.
- Fixed: 2
- Skipped: 0

**Where verification ran:** in the main checkout `/home/user/pi-claude-marketplace`
(branch `claude/quirky-planck-hhm592`), not in an isolated worktree. Each commit
went through the normal pre-commit hook. The hook ran `npm run check:commit`
(static checks, `test:unpaired`, and direct coverage for the staged
`shell-words` pair), and it passed. Every npm script and commit ran with the
root-sandbox wrapper (`npm_config_script_shell=.../nondac-sh`,
`NODE_OPTIONS=--max-old-space-size=6144`). The full `npm run check` was not
re-run.

## Fixed Issues

### WR-01: `skipBareDollar` drops the `\$` after a glued assignment value

**Files modified:** `extensions/pi-claude-marketplace/domain/shell-words.ts`, `test/domain/shell-words.test.ts`
**Commit:** 3d8d144
**Applied fix:** `readCommandItem` now calls `skipBareDollar` only when the
command is already named or the word is not an assignment
(`command.named || !ASSIGNMENT.test(word.raw)`). This is the reviewer's guard.
The four oracle rows `x="a"\$ b c`, `x='a'\$ b`, `x=$X\$ b`, and `x=b"a"\$ b`
were added to `UPSTREAM_ROWS`. I re-checked each one against the oracle
(tree-sitter-bash 0.25.1, `scripts/ck2.mjs`).

Oracle results. "HEAD" is the tree before this fix. "old" is the copy from
before f9e7659.

| set | inputs | match after fix | match at HEAD | regressions vs HEAD | regressions vs old | fixed vs HEAD |
|---|---|---|---|---|---|---|
| reviewer grid (`rr2/grid.jsonl`) | 53,248 | 44,169 | 43,689 | 0 | 0 | 480 |
| gen2 (`rr2/u.jsonl`) | 28,270 | 28,260 | 28,260 | 0 | 0 | 0 |
| punctuation (`rr2/v.jsonl`) | 36,000 | 27,833 | 27,833 | 0 | 0 | 0 |
| `up2`..`up5`, `fixer/rows` | 6,979 | unchanged | unchanged | 0 | 0 | 0 |

### IN-05: A lone `$` followed by `\$<char>` differs from upstream

**Files modified:** `extensions/pi-claude-marketplace/domain/shell-words.ts`, `test/domain/shell-words.test.ts`
**Commit:** 1e0d0e9
**Outcome: ported.** It stays within the ESLint and fallow complexity limits
(`eslint --max-warnings 0` is clean, `fallow health` reports no `shell-words`
finding, and `check:commit` passed). Direct coverage of `shell-words.ts` stays
at 100% lines, branches, and functions.

**Applied fix:** two rules, both measured against the oracle. The parse trees
show that both come from tree-sitter-bash error recovery: it wraps the lone `$`
in an ERROR node.

1. In `readDollar`, if `\$` and a letter or decimal digit follow a lone `$`
   (`/\\\$[\p{Alphabetic}\p{Nd}]/uy`), the three characters form one
   expansion piece that keeps its backslash. Any later word text joins it, so
   `x $\$5 y` gives `["x","$\\$5","y"]`. I checked the character class on all
   94 printable ASCII characters and 26 non-ASCII ones (`é`, `ß`, `中`, `²`,
   `½`, `①`, `Ⅳ`, `٣`, a combining accent, an emoji, `＿`, and others). `_`,
   `²`, `½`, and `①` are excluded upstream, and the class excludes them too.
2. In `addWord`, before the command is named, a word that is a lone `$`
   followed by `\$` is dropped. The `\$` word then names the command, so
   `$\$ b` gives `["$","b"]` and `$\$$X b` gives `["$$X","b"]`.

New `UPSTREAM_ROWS`, each re-checked against the oracle: `x $\$5 y`,
`x $\$a b`, `x $\$é y`, `x $\$_ y` (the excluded `_`), `$\$ b`, and `$\$$X b`.

Oracle results. "HEAD" here is 3d8d144, the tree after the WR-01 fix.

| set | inputs | match after fix | match at 3d8d144 | regressions vs 3d8d144 | fixed |
|---|---|---|---|---|---|
| reviewer grid | 53,248 | 45,208 | 44,169 | 0 | 1,039 |
| gen2 | 28,270 | 28,260 | 28,260 | 0 | 0 |
| punctuation | 36,000 | 27,859 | 27,833 | **1** | 26 net (27 fixed) |
| character probe (`fixer3/chars.jsonl`) | 198 | 187 | 28 | 0 | 159 |
| Unicode probe (`fixer3/uni.jsonl`) | 42 | 42 | 9 | 0 | 33 |
| `up2`..`up5`, `fixer/rows` | 6,979 | unchanged | unchanged | 0 | 0 |

The one regression is `$\$ [=x=1 ;\'q'`. A later statement there holds an
unclosed single quote, and that changes how tree-sitter-bash recovers the
first command: it keeps the lone `$` as the command name. The smallest form I
found is `$\$ b; c'`, which gives upstream `["$","$","b"]` and port `["$","b"]`.
This is error recovery after an unclosed quote, which D-CF1-01 licenses. I
recorded `$\$ b; c'` in `RESIDUAL_ROWS` with upstream's output.

**Remaining lone-`$\$` differences (not ported):** a lone `$\$` followed by
`'`, `(`, `)`, `` ` ``, `{`, or `}`. Examples: `x $\$'q y` gives upstream
`["x"]`, and `x $\$}q y` gives upstream `["x","q","y"]`. Every one of these
also leaves a quote or bracket unbalanced, so tree-sitter-bash recovers
differently by context. They fall under the module header's best-effort
error-recovery clause. 11 of the 198 character-probe inputs still differ, all of this kind.

**Behavioral test:** none added. `splitArguments` has no production caller
yet. Its only importer is `domain/argument-substitution.ts`, which nothing
imports. Both are in `.fallowrc.json`'s `dynamicallyLoaded` list (IN-02). So no
`/claude:plugin` behavior changes.

---

_Fixed: 2026-11-01T07:05:56Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_

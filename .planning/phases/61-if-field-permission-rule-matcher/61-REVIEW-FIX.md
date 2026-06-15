---
status: all_fixed
findings_in_scope: 8
fixed: 8
skipped: 0
iteration: 2
fix_scope: all
applied: 2026-06-15
---

# Phase 61 — Code Review Fix Report

Cumulative report covering both iterations of `/gsd-code-review --fix` for
Phase 61. Iteration 1 (`fix_scope: critical_warning`) landed the 1 BLOCKER
+ 4 WARNING fixes; iteration 2 (`fix_scope: all`) lands the 3 INFO
housekeeping fixes. All 8 findings from `61-REVIEW.md` are now fixed.

`npm run check` is GREEN end of iteration 2: 2151 unit tests pass, 10
integration tests pass, 0 fail, 0 todo.

## Fix commits

| SHA | Title | Scope | Iteration |
|-----|-------|-------|-----------|
| `c6d4c61` | `fix(61-04): bash glob matcher consumes path-bearing args (CR-01)` | Critical | 1 |
| `3520d3f` | `fix(61-04): drop Plan 01 token from hooks.ts comment (WR-01)` | Warning | 1 |
| `86f7013` | `fix(61-04): correct globstar complexity claim in glob.ts (WR-02)` | Warning | 1 |
| `4cb4d41` | `docs(61-04): document fail-open trade-off in bash.ts $VAR detection (WR-03)` | Warning | 1 |
| `599484c` | `fix(61-04): honor backslash-escaped separators in Bash splitter (WR-04)` | Warning | 1 |
| `aa6359f` | `perf(61-04): skip if-predicate map walk in resolver probe (IN-01)` | Info | 2 |
| `207e56d` | `style(61-04): strip Phase 57 token from install.ts comment (IN-02)` | Info | 2 |
| `9112a0d` | `docs(61-04): document extractToolName empty-string coercion (IN-03)` | Info | 2 |

## Iteration 1 — Critical + Warning (5 fixes)

### CR-01 — Bash glob matcher consumes path-bearing args (FIXED)

**Issue:** `bridges/hooks/if-field/glob.ts` reused the shared `matchStar` whose
`/` short-circuit (correct for gitignore-semantics path globs) caused
`Bash(<cmd> *)` patterns to silently fail-CLOSED on path-bearing arguments
(`Bash(rm *)` did NOT match `rm /tmp/foo`).

**Fix:** Threaded a `crossSegment: boolean` flag through `matchTokens` /
`matchStar` / `matchGlobstar`. Path-tool callers pass `false` (preserves
gitignore semantics — `Read(*.ts)` still does NOT cross `/`). The Bash
caller passes `true` (subcommands have no path-segment semantics).

**Regression test:** `tests/architecture/hooks-if-field.test.ts` ships a
new `BASH_PATH_ARG_TABLE` covering `rm /tmp/foo`, `cat /etc/passwd`,
`git push origin/main`, `find ./src`, and a negative `lsof /var/log` case
that preserves the word-boundary semantic.

### WR-01 — `Plan 01 placement` comment-policy violation (FIXED)

**Issue:** `domain/components/hooks.ts:46` carried a fresh `Plan 01 placement`
token introduced in commit `3b1de5d` (Phase 61 squash-merge).

**Fix:** Comment rewritten to use the decision-anchor form
(`.claude/rules/typescript-comments.md`-compliant).

### WR-02 — Globstar complexity claim overclaim (FIXED)

**Issue:** `glob.ts:211-256` block comment claimed "linear-time" matching,
but multi-globstar patterns are O(N×M) (single `**`) up to O(N^K) for
K-nested `**`.

**Fix:** Comment corrected to acknowledge the true worst-case complexity.
No algorithmic change — the practical surface (Bash-subcommand length ×
glob-pattern length) makes catastrophic blow-up unrealistic.

### WR-03 — `$VAR` detection quote-naïveté (DOCUMENTED)

**Issue:** `bash.ts:107` `INTERPOLATION_RE` triggers specificity-override
on `$VAR` literals inside single quotes (treats them as interpolated
variables).

**Fix:** JSDoc updated to document the fail-OPEN trade-off, citing
upstream's "best-effort, not a security boundary" wording. No behavioral
change.

### WR-04 — Backslash escapes in compound-separator splitter (FIXED)

**Issue:** `bash.ts:197-221` splitter did not honor backslash escapes; `\;`
and `\&&` outside quotes split where they shouldn't.

**Fix:** Backslash-escape handling added to the splitter so escaped
separators don't split.

## Iteration 2 — Info housekeeping (3 fixes)

### IN-01 — `noopCompileIf` iterates handlers unnecessarily (FIXED)

**Files modified:**
- `extensions/pi-claude-marketplace/domain/components/hooks.ts`
- `extensions/pi-claude-marketplace/domain/resolver.ts`

**Commit:** `aa6359f`

**Issue:** The resolver's `applyHooksConfig` probe (called from `list`/`info`)
discarded the compiled `ifPredicates` side-Map but still walked every
`if`-bearing handler via `buildIfPredicateMap`, storing a `null` per
handler that nobody consumed.

**Applied fix:** Added an opt-in `options.skipIfMap?: boolean` parameter
to `parseHooksConfig`. When `true`, the success arm returns an empty
`Map<string, P>()` directly without invoking `compileIf` for any handler.
The resolver call site now passes `{ skipIfMap: true }`; bridge cache
hydrate / install / reinstall / update keep the default and still receive
the fully compiled map.

**Verification:** TypeScript strict passes; full `hooks.test.ts` (98
tests) green; full architecture suite (206 tests) green; `npm run check`
GREEN.

### IN-02 — Pre-existing `Phase 57` token in install.ts (FIXED)

**Files modified:**
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`

**Commit:** `207e56d`

**Issue:** A `Phase 57 SUPPORTED_COMPONENT_KINDS extension` comment in
`install.ts:1564` carried a banned `Phase NN` planning-step token
(`.claude/rules/typescript-comments.md`). Pre-existing (predates Phase 61
work) but surfaced by the comment-policy audit.

**Applied fix:** Replaced `Phase 57 SUPPORTED_COMPONENT_KINDS extension`
with `the SUPPORTED_COMPONENT_KINDS extension`. The surrounding
`HOOK-04 / D-58-02` decision anchors already carry the equivalent
traceability; the parenthetical phrase alone is enough to locate the
call site historically. Comment-only change, no behavioral impact.

### IN-03 — `extractToolName` empty-string coercion undocumented (FIXED)

**Files modified:**
- `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts`

**Commit:** `9112a0d`

**Issue:** `extractToolName` coerces missing or non-string `toolName` to
`""`. The behavior is correct (empty string is rejected by every
downstream MCP arm) but the rationale was not documented in JSDoc.

**Applied fix:** Added a JSDoc block explaining the fail-CLOSED design:
every downstream check (`piEvents` membership for `path-tool`, literal
equality for `mcp-literal`, `startsWith` for `mcp-server-prefix`) rejects
the empty string, so a malformed event payload matches no MCP-shaped
predicate arm. Documentation-only change.

## Quality bar

- `npm run check`: **GREEN** — 2151 unit tests pass, 10 integration tests
  pass, 0 fail, 0 todo.
- TypeScript strict (NFR-7): preserved.
- IL-2 (debug-log only at runtime): preserved — no new `ctx.ui.notify`
  calls.
- Comment policy (`.claude/rules/typescript-comments.md`): WR-01 and
  IN-02 violations cleared.
- No new runtime deps: `package.json` unchanged.
- Pre-commit hooks: all passed on the modified files (trufflehog scan
  passed standalone with `pre-commit run trufflehog --all-files` per the
  worktree-sandbox workaround documented in CLAUDE.md).

## Spot-checks of iteration 1 fixes (re-verified in iteration 2)

Before applying the iteration-2 fixes, every iteration-1 fix was
spot-checked against the source tree to confirm it survived the
cumulative branch state:

| Finding | Anchor | Status |
|---|---|---|
| CR-01 | `grep crossSegment glob.ts` | present (5 matches) |
| WR-01 | `grep "Plan 01" hooks.ts` | absent (cleared) |
| WR-02 | `grep "O(text.length \*\* N)" glob.ts` | present (line 39) |
| WR-03 | `grep "best-effort, not a security boundary" bash.ts` | present (line 112) |
| WR-04 | `grep "backslash escapes" bash.ts` | present (line 207) |

No deviations.

## Note on report location

This file is written directly to the main working tree (not the agent
worktree) per the phase-context guidance, so it survives worktree
cleanup. The orchestrator commits this file separately.

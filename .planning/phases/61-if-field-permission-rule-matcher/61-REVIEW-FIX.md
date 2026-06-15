---
status: all_fixed
findings_in_scope: 5
fixed: 5
skipped: 0
iteration: 1
fix_scope: critical_warning
applied: 2026-06-15
---

# Phase 61 — Code Review Fix Report

> Reconstructed by orchestrator after worktree cleanup lost the fixer's
> in-flight report. All 5 fix commits landed on `features/v1.13-hook-bridge`
> and `npm run check` is GREEN (2151 unit tests pass, +1 from the CR-01
> regression suite). The original REVIEW.md (status: `issues_found`)
> remains the authoritative record of what was found; this file documents
> what was fixed.

## Fix commits

| SHA | Title | Scope |
|-----|-------|-------|
| `c6d4c61` | `fix(61-04): bash glob matcher consumes path-bearing args (CR-01)` | Critical |
| `3520d3f` | `fix(61-04): drop Plan 01 token from hooks.ts comment (WR-01)` | Warning |
| `86f7013` | `fix(61-04): correct globstar complexity claim in glob.ts (WR-02)` | Warning |
| `4cb4d41` | `docs(61-04): document fail-open trade-off in bash.ts $VAR detection (WR-03)` | Warning |
| `599484c` | `fix(61-04): honor backslash-escaped separators in Bash splitter (WR-04)` | Warning |

## Finding-by-finding disposition

### CR-01 — Bash glob matcher consumes path-bearing args (FIXED)

**Issue:** `bridges/hooks/if-field/glob.ts` reused the shared `matchStar` whose
`/` short-circuit (correct for gitignore-semantics path globs) caused
`Bash(<cmd> *)` patterns to silently fail-CLOSED on path-bearing arguments
(`Bash(rm *)` did NOT match `rm /tmp/foo`).

**Fix:** Threaded a `crossSegment: boolean` flag through `matchTokens` /
`matchStar` / `matchGlobstar`. Path-tool callers pass `false` (preserves
gitignore semantics — `Read(*.ts)` still does NOT cross `/`). The Bash
caller passes `true` (subcommands have no path-segment semantics).

**Regression test:** `tests/architecture/hooks-if-field.test.ts` ships a new
`BASH_PATH_ARG_TABLE` covering `rm /tmp/foo`, `cat /etc/passwd`,
`git push origin/main`, `find ./src`, and a negative `lsof /var/log` case
that preserves the word-boundary semantic. 2151 → 2151 tests pass; the new
fixture adds 5 assertions inside a single subtest suite.

### WR-01 — `Plan 01 placement` comment-policy violation (FIXED)

**Issue:** `domain/components/hooks.ts:46` carried a fresh `Plan 01 placement`
token introduced in commit `3b1de5d` (Phase 61 Plan 02).

**Fix:** Comment rewritten to use the decision-anchor form
(`.claude/rules/typescript-comments.md`-compliant).

### WR-02 — Globstar complexity claim overclaim (FIXED)

**Issue:** `glob.ts:211-256` block comment claimed "linear-time" matching, but
multi-globstar patterns are O(N×M) (single `**`) up to O(N^K) for K-nested
`**`.

**Fix:** Comment corrected to acknowledge the true worst-case complexity.
No algorithmic change — the practical surface (Bash-subcommand length ×
glob-pattern length) makes catastrophic blow-up unrealistic.

### WR-03 — `$VAR` detection quote-naïveté (DOCUMENTED)

**Issue:** `bash.ts:107` `INTERPOLATION_RE` triggers specificity-override on
`$VAR` literals inside single quotes (treats them as interpolated variables).

**Fix:** JSDoc updated to document the fail-OPEN trade-off, citing upstream's
"best-effort, not a security boundary" wording. No behavioral change — the
trade-off is upstream-faithful (Claude Code's permission system has the
same limitation).

### WR-04 — Backslash escapes in compound-separator splitter (FIXED)

**Issue:** `bash.ts:197-221` splitter did not honor backslash escapes; `\;`
and `\&&` outside quotes split where they shouldn't.

**Fix:** Backslash-escape handling added to the splitter so escaped
separators don't split. Extension of the existing QuoteCursor; small
surgical change.

## Out of scope (deliberately skipped — `critical_warning` scope)

- **IN-01** — `resolver.ts` `noopCompileIf` iterates handlers unnecessarily (micro-optimization)
- **IN-02** — Pre-existing `Phase 57` token in `install.ts:1564` (out-of-scope housekeeping; predates Phase 61)
- **IN-03** — `extractToolName` empty-string coercion is correct but undocumented (JSDoc improvement)

These remain visible in `61-REVIEW.md` for future cleanup. Re-run with
`/gsd-code-review 61 --fix --all` to include them.

## Quality bar

- `npm run check`: **GREEN** — 2151 unit tests pass (+1 from CR-01 regression suite); 0 fail; 0 todo.
- TypeScript strict (NFR-7): preserved — `crossSegment` is a plain boolean param, no `any`.
- IL-2 (debug-log only at runtime): preserved — fixes added no `ctx.ui.notify` calls.
- Comment policy (`.claude/rules/typescript-comments.md`): WR-01 violation cleared; pre-existing IN-02 violation deferred.
- No new runtime deps: package.json unchanged.

## Note on missing report

The fixer agent's worktree was force-removed after fast-forward into
`features/v1.13-hook-bridge`. The 5 fix commits flowed back correctly but
the in-flight REVIEW-FIX.md (uncommitted in the worktree) was lost in the
cleanup. This file is a reconstruction from the fixer's return summary and
git log inspection. Future work: have the fixer write REVIEW-FIX.md to the
main working tree directly (not the agent worktree) so it survives cleanup.

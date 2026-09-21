---
quick_id: 260919-c5m
slug: standardize-on-agents-md-instead-of-clau
date: 2026-09-19
status: complete
one-liner: Renamed CLAUDE.md to AGENTS.md and dropped both workarounds that existed only to keep CLAUDE.md as the canonical instructions file
key-files:
  created: []
  modified:
    - AGENTS.md (renamed from CLAUDE.md)
    - .codex/config.toml
    - scripts/init.sh
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - docs/competitive-analysis/pi-plugins.md
    - .claude/commands/analyze-upstream-releases.md
commit: 8f87272a
branch: worktree-agent-a6c01acd72a3806f5 (isolated worktree branch off features/standardize-agents-md)
---

# Standardize on AGENTS.md instead of CLAUDE.md Summary

Renamed `CLAUDE.md` to `AGENTS.md` so both Claude Code (2.1.277+, which now reads
`AGENTS.md` natively when no `CLAUDE.md` exists) and Codex read the same canonical
project-instructions file with no configuration, and removed the two workarounds
that existed only to bridge the naming mismatch.

## What was built

**Task 1 — Rename and drop both workarounds:**
- `git mv CLAUDE.md AGENTS.md` — a pure rename (0 insertions, 0 deletions); the file
  never named itself so no content edit was needed. The `<!-- CODEGRAPH_START -->`
  marker block rode along intact.
- `.codex/config.toml`: deleted the `project_doc_fallback_filenames = ["CLAUDE.md"]`
  setting and its preceding comment (3 lines), since Codex now reads `AGENTS.md`
  natively. Kept `project_doc_max_bytes`, which still applies to `AGENTS.md`.
- `scripts/init.sh`: narrowed the final `rm -f AGENTS.md .claude/CLAUDE.md` to
  `rm -f .claude/CLAUDE.md` only, and reworded the preceding comment to explain
  the remaining removal (the generated per-tool copy would shadow the root file)
  without naming the bare old filename.

**Task 2 — Repointed three stale references:**
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` line 35:
  `per CLAUDE.md IL-2` -> `per AGENTS.md IL-2` (kept the `IL-2` traceability id).
- `docs/competitive-analysis/pi-plugins.md` line 457: swapped the first of three
  backticked filenames to `` `AGENTS.md` ``.
- `.claude/commands/analyze-upstream-releases.md` line 125: swapped `` `CLAUDE.md` ``
  to `` `AGENTS.md` `` in "Per `AGENTS.md`, repo edits route through a GSD entry point".
- Confirmed `docs/research/claude-hooks-vs-pi-events.md` was correctly left alone —
  its four mentions describe Claude Code's own upstream `InstructionsLoaded` event
  and context-file set, not this repo's canonical file.

**Task 3 — Gated and committed:**
- Staged the five explicit-path files plus the already-staged rename.
- One deviation from the plan's staging mechanism, per this run's `<critical_context>`:
  this worktree started with no local `[mcp_servers.codegraph]` table in
  `.codex/config.toml` (that table only ever existed as an uncommitted local change
  in the primary checkout, stashed before dispatch), so the plan's `git show HEAD:...`
  / `git update-index --cacheinfo` plumbing was unnecessary — a plain
  `git add .codex/config.toml` was staged and verified to show only the 3 intended
  deletions and 0 insertions, with no `mcp_servers` token, satisfying the same gate
  the plan's plumbing was designed to protect.
- Ran `pre-commit run --all-files` (`SKIP=trufflehog`). One environment gap
  surfaced and was fixed: this fresh worktree had no `node_modules` (gitignored,
  never materialized for a brand-new worktree checkout), so the `prettier` hook
  failed with "Executable `node_modules/.bin/prettier` not found" while the
  `npm run *` hooks all happened to resolve their tools via a global toolchain on
  `PATH` and passed. Ran `npm ci` (exact lockfile install, no new/unverified
  packages) to materialize `node_modules`, then re-ran `pre-commit run --all-files`
  clean end to end.
- Committed with `git commit -F <scratchpad message file>` (no pathspec, no `-a`),
  title `chore: standardize on AGENTS.md as the project instructions file` (64
  chars), body lines all <=71 chars, ending with the session's attribution trailer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `node_modules` absent in the fresh worktree, breaking the `prettier` pre-commit hook**
- **Found during:** Task 3, first `pre-commit run --all-files`
- **Issue:** `prettier` hook hardcodes `entry: node_modules/.bin/prettier --write`;
  the isolated worktree had never had `npm install`/`npm ci` run in it, so the
  binary did not exist. All other `npm run *` hooks happened to pass anyway,
  resolving `tsc`/`eslint`/`fallow` via a global toolchain already on `PATH`.
- **Fix:** Ran `npm ci` (installs exactly what `package-lock.json` already pins —
  not a new/unverified package, so this is outside the package-install exclusion
  in Rule 3) to materialize `node_modules`, then re-ran `pre-commit run --all-files`,
  which passed clean with no further changes.
- **Files modified:** none (only `node_modules/` materialized, which is gitignored
  and untracked)
- **Commit:** N/A (no tracked file changed by this fix)

**2. [Adaptation per dispatch `<critical_context>`] Simplified `.codex/config.toml` staging**
- **Found during:** Task 3, step 2
- **Issue:** The plan's staging step used `git show HEAD:.codex/config.toml | tail -n +4 | git hash-object -w --stdin` plus `git update-index --cacheinfo` specifically to keep a locally-uncommitted `[mcp_servers.codegraph]` table (present in the primary checkout's working tree) out of the commit. That table does not exist anywhere in this isolated worktree's working copy of the file.
- **Fix:** Staged the file directly with a plain `git add .codex/config.toml` and verified via `git diff --cached -- .codex/config.toml` that it showed exactly 3 deletions, 0 insertions, and no `mcp_servers` token — the same gate the plan's plumbing targeted, reached by a simpler path since there was nothing to protect against in this working tree. This adaptation was explicitly authorized by the dispatch instructions.
- **Files modified:** `.codex/config.toml` (per Task 1's plan-specified edit)
- **Commit:** 8f87272a

Or otherwise: plan executed exactly as written.

## Self-Check: PASSED

- `AGENTS.md` exists, is tracked (`git ls-files AGENTS.md`), and carries the
  `CODEGRAPH_START` marker (1 occurrence, 140 lines total) — FOUND
- `CLAUDE.md` no longer exists at the repo root — CONFIRMED ABSENT
- No file under `.codex/` sets `project_doc_fallback_filenames` (grep exits 1) — CONFIRMED
- `scripts/init.sh` removes only `.claude/CLAUDE.md`, never names `AGENTS.md` — CONFIRMED
- Repo-wide sweep for `CLAUDE\.md` (excluding `.git`, `node_modules`, `.planning`,
  `.codegraph`) returns exactly the 4 lines in `docs/research/claude-hooks-vs-pi-events.md`
  (lines 11, 68, 283, 292) plus the `scripts/init.sh:36` generated-copy removal line — CONFIRMED
- `pre-commit run --all-files` clean (all 34 hooks Passed or Skipped, after the
  `npm ci` fix above) — CONFIRMED
- Commit `8f87272a` on branch `worktree-agent-a6c01acd72a3806f5` (this run's isolated
  worktree branch, forked from `features/standardize-agents-md`) contains exactly
  the six expected paths: the `CLAUDE.md => AGENTS.md` rename, `.codex/config.toml`,
  `scripts/init.sh`, `autoupdate.ts`, `pi-plugins.md`, `analyze-upstream-releases.md`.
  No local CodeGraph MCP wiring exists anywhere in this worktree's working tree or
  history, so item 7 of the plan's Verification section ("commit contains no part
  of the local CodeGraph MCP wiring, and that wiring is still present and
  uncommitted") is vacuously satisfied here — there is no such wiring in this
  worktree to leak or lose. `git status --short` in the worktree is fully clean
  (no leftover local-only files, since none existed at dispatch time) and
  `git diff --cached --quiet` exits 0 (nothing left staged) — CONFIRMED
- `git log --oneline -1` shows a 64-character Conventional Commits title — CONFIRMED

## Metrics

- **Duration:** ~25 minutes
- **Tasks:** 3/3 complete
- **Commits:** 1 (`8f87272a`)

---
quick_id: 260913-uwq
slug: issue-179-agent-tools-and-mcpservers-con
date: 2026-09-13
status: complete
type: execute
subsystem: bridges/agents
tags: [agents, tools, pi-subagents, upstream-parity, gate, commit]
requires:
  - pi-subagents >= 0.62.0 for excludeTools (earlier versions store-and-ignore the key)
provides:
  - Omitted source `tools:` converts to no allowlist, so pi-subagents grants its defaults
  - "`disallowedTools` maps to `excludeTools` when no allowlist is emitted"
  - Targeted guidance warnings for the dropped `allowed-tools` and `mcpServers` fields
affects:
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
tech-stack:
  added: []
  patterns:
    - Discriminated `omitted` flag on ToolMappingResult so the emitter distinguishes "no allowlist" from "empty allowlist"
    - Optional non-empty-tuple frontmatter fields keep the AG-11 invariant in the type
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - tests/bridges/agents/convert.test.ts
    - tests/bridges/agents/frontmatter.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - docs/prd/pi-claude-marketplace-prd.md
    - README.md
    - CHANGELOG.md
decisions:
  - Scoped `pre-commit run --files` over the nine paths rather than `--all-files`, so
    writing hooks could not rewrite tracked files the operator owns
  - Commit message delivered via `-F <file>`, never `-m`, because the body names
    `tools:`, `excludeTools`, and `mcpServers` in backticks
metrics:
  duration: 15m
  completed: 2026-09-14
actuals:
  tokens: 10594
  tasks: 2
  commits: 1
plan_head_before: bd4901916a6e3d2ceb78ff984b80380236ba4c98
---

# Quick Task 260913-uwq: Issue 179 Agent Tools and mcpServers Conversion Summary

Gated and committed the finished issue-179 work as one atomic nine-path commit: an
agent that omits `tools:` now inherits Pi's default toolset instead of a narrow
`read,bash,edit` allowlist, and the two dropped agent fields carry their own guidance.

## What Happened

This plan carried no implementation tasks. The issue-179 change was already complete and
uncommitted in the working tree; the job was to prove it green and land it without
disturbing the operator's concurrent edits in the same checkout.

### Task 1 — Full gate

`npm run check` ran unpiped with the exit status captured from `$?`, output to a log so
the ~6000-test spec stream stayed out of context.

**Result: `EXIT=0`.**

The pass was checked for vacuousness rather than read off a green-looking tail: all
eleven sub-gates were confirmed to have actually run, in order — `typecheck`, `lint`,
`lint:workflows`, `lint:workflows:negative`, `fallow`, `format:check`,
`test:corresponding`, `test:corresponding:negative`, `test:coverage:direct:negative`,
`test`, `test:integration`. The chain short-circuits, so a missing sub-gate name in the
log would have meant an earlier one failed.

No fix was needed. Zero edits were made to implementation files.

### Task 2 — Pre-commit, staging, commit

`SKIP=trufflehog pre-commit run --files "${FILES[@]}"` over the nine paths, with the path
list held in one shell array driving all three uses (hook run, staging, scope assertion).

- **First pass: `EXIT=1`** — `mdformat` reported "files were modified by this hook". This
  is the anticipated writing-hook behavior, not a failure. `git status --porcelain` was
  compared against the pre-run listing and was byte-identical: the rewrite (table-column
  realignment in the PRD's "Agent conversion" row) landed only inside the nine.
- **Second pass: `EXIT=0`**, 23 hooks passed, 0 failed. The `npm direct coverage (changed
  pairs)` hook — the one gate `npm run check` does not carry — passed.
- Staged with `git add -- "${FILES[@]}"`. `git diff --cached --name-only` asserted
  **exactly 9 paths, 0 matching `.claude/` or `.codex/`** before the commit, not after.
- Committed with `git commit -F <file>`.

**Commit `a9186816`** — `fix(agents): inherit Pi defaults when tools is omitted (#179)`.
Title 61 characters, no body line over 80, no milestone or phase reference.

## Verification

The plan's verify block, run verbatim against the commit:

| Check | Expected | Actual |
| --- | --- | --- |
| `git show --stat --name-only --format= HEAD \| grep -c .` | `9` | `9` |
| `git show --name-only --format= HEAD \| grep -Ec '^(\.claude/\|\.codex/)'` | `0` | `0` |
| `pre-commit run gitlint --hook-stage commit-msg` on `COMMIT_EDITMSG` | passes | Passed |
| `git status --porcelain` | 2 out-of-scope `M`, 4 `??`, no in-scope path left | matches |
| `git rev-list --count bd490191..HEAD` | 1 | 1 |
| Deletions in the commit | none | 0 |

The out-of-scope tracked pair (`.claude/settings.json`, `.codex/config.toml`) and the
four untracked entries (`.mcp.json`, `AGENTS.md`, `.codegraph/`, `.claude/CLAUDE.md`)
survived uncommitted, unstaged, and unreverted. The only extra `??` entry is this task's
own `.planning/quick/260913-uwq-*/` directory, which the orchestrator commits separately.

Both `gitlint` runs stashed and restored unstaged files. The tree was re-inspected after
each — staged set and working tree both intact, no `UU`/`AA` residue.

## Deviations from Plan

None affecting behavior or scope. One procedural note:

**[Procedural] Worktree branch namespace.** The executor's worktree guard expects HEAD on
an `agent-*` / `worktree-agent-*` branch. This checkout is the operator's own worktree on
`features/issue-179`, which the orchestrator directed committing to. The substantive
safety check — HEAD is attached and is not a protected or default branch — was run and
passed. No self-recovery or ref rewriting was performed.

The `mdformat` rewrite and the first-pass `EXIT=1` were both predicted by the plan and
are not deviations.

## What Changed (for reviewers)

- **`convert.ts`** — `mapTools` returns a new `omitted` flag plus an `excludeTools` list.
  The omitted-`tools:` branch no longer synthesizes `["Read","Bash","Edit"]` or warns;
  it returns an empty mapped list with `omitted: true`. `inheritSkills` on that path now
  follows the disallow check alone, since an omitted `tools:` implicitly grants `Skill`.
  The AG-11 empty-list throw moved into `assertMappedToolsNonEmpty`, which returns early
  when `omitted` is set — so an omitted `tools:` is no longer an error. New
  `droppedFieldWarnings` and the exported `GUIDED_DROPPED_FIELDS` set.
- **`frontmatter.ts`** — `tools` became optional and `excludeTools` was added, both as
  optional non-empty tuples. The emitter's deterministic field order now places
  `excludeTools` after `tools`; the two are never emitted together.
- **`stage.ts`** — the generic `dropped fields:` summary line filters out
  `GUIDED_DROPPED_FIELDS`, so `allowed-tools` and `mcpServers` are not reported twice.
- **Docs** — AG-11 and the AG-7 `tools:`/`disallowedTools:` details were restated in the
  PRD, a new `allowed-tools:` / `mcpServers:` bullet added, and the test-coverage table
  row updated. `CHANGELOG.md` carries both entries under `## [Unreleased]`.

## Known Stubs

None. The committed additions were scanned for `TODO`, `FIXME`, placeholder text,
`.skip(`, and `.todo(` — no matches.

## Threat Flags

None. The change surface matches the plan's threat register (T-uwq-01 through T-uwq-03,
all dispositioned `accept` below the `high` blocking threshold). No new network endpoint,
auth path, file-access pattern, or trust-boundary schema change was introduced. No
packages were installed.

## Follow-ups (explicitly out of scope here)

- **Version bump.** `package.json`, `sonar-project.properties`, and `package-lock.json`
  are untouched; the house convention offers the bump at PR time. The `EXTENSION_VERSION`
  constant and Sonar `projectVersion` travel with that bump.
- **Opening the PR.** This task ended at the commit.
- **CI Lint `--all-files`.** The scoped `--files` run cannot see pre-existing violations
  in tracked files outside the nine. If CI Lint reddens on an unrelated file, that is a
  separate task and not a reason to widen this commit.

## Self-Check: PASSED

- Commit `a9186816` exists on `features/issue-179` — verified via `git log`.
- All nine modified files exist and are present in the commit's `--name-only` list.
- `plan_head_before` `bd490191` matches the recorded ledger; `git rev-list --count`
  measures exactly 1 commit.

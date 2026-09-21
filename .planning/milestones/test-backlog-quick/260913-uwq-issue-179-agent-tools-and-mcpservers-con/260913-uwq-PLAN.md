---
quick_id: 260913-uwq
slug: issue-179-agent-tools-and-mcpservers-con
date: 2026-09-13
status: planned
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: ["#179", "AG-7", "AG-11"]
files_modified:
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - tests/bridges/agents/convert.test.ts
  - tests/bridges/agents/frontmatter.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - docs/prd/pi-claude-marketplace-prd.md
  - README.md
  - CHANGELOG.md
estimate:
  tokens: 35000
  raw_tokens: 35000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "`npm run check` exits 0 against the working tree as it stands"
    - "`pre-commit run --files <the 9 paths>` exits 0, with any hook rewrite restaged rather than left loose"
    - "Exactly one new commit exists on `features/issue-179`, carrying exactly the 9 in-scope paths"
    - "The two unrelated tracked modifications and the four untracked entries survive uncommitted and unreverted"
  artifacts:
    - "One commit on `features/issue-179` whose `--name-only` list is the 9 paths and nothing else"
  key_links:
    - "`git show --name-only HEAD` <-> the 9-path scope (no `.claude/`, no `.codex/`)"
    - "`git status --porcelain` after the commit <-> the same 2 `M` and 4 `??` entries seen before it"
---

# Quick Task 260913-uwq

Gate and commit the completed issue-179 work: agents with no `tools:` inherit Pi's
default toolset, and the two dropped agent fields get targeted guidance.

## Scope, measured this session

**The implementation is finished and uncommitted.** This plan contains zero
implementation tasks. Nothing here writes TypeScript, and nothing here is a tracer
slice — there is no architecture left to prove, only a gate to run and a commit to
make. If a gate goes red, the fix is the minimum edit that turns it green, not a
redesign.

`git status --porcelain` on `features/issue-179` shows eleven tracked modifications.
Nine are this task's; two are not:

| In scope (commit these)                                        | Out of scope (must not be staged)       |
| -------------------------------------------------------------- | --------------------------------------- |
| `extensions/pi-claude-marketplace/bridges/agents/convert.ts`     | `.claude/settings.json` (modified)      |
| `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` | `.codex/config.toml` (modified)         |
| `extensions/pi-claude-marketplace/bridges/agents/stage.ts`       | `.mcp.json` (untracked)                 |
| `tests/bridges/agents/convert.test.ts`                           | `AGENTS.md` (untracked)                 |
| `tests/bridges/agents/frontmatter.test.ts`                       | `.codegraph/` (untracked)               |
| `tests/orchestrators/reconcile/apply.test.ts`                    | `.claude/CLAUDE.md` (untracked)         |
| `docs/prd/pi-claude-marketplace-prd.md`                          |                                         |
| `README.md`                                                      |                                         |
| `CHANGELOG.md`                                                   |                                         |

Never `git add -A`, never `git add .`, never `git checkout --` anything in the right
column. The operator edits files and switches branches in this checkout concurrently.

## Verified during planning — do not re-derive

- **This checkout is a git worktree.** `.git` is a 92-byte file, and `core.hooksPath`
  points at `/home/acolomba/pi-claude-marketplace/.git/hooks`. TruffleHog fails here
  with `.git/index: not a directory`, so every `pre-commit` and `git commit`
  invocation takes the `SKIP=trufflehog` prefix.
- **No pre-commit git hook is installed.** That hooks directory holds only
  `post-checkout`, `post-commit`, `post-merge`, `pre-push`. `git commit` therefore
  fires nothing — the `pre-commit` run is manual and is the only thing standing
  between this change and CI's Lint job. `gitlint` is a `commit-msg`-stage hook and
  will not run either, so the message rules are hand-checked (task 2).
- **`npm run check` is longer than it looks.** It is eleven sub-gates, not five:
  `typecheck && lint && lint:workflows && lint:workflows:negative && fallow &&
  format:check && test:corresponding && test:corresponding:negative &&
  test:coverage:direct:negative && test && test:integration`. Budget for it; do not
  substitute `npm test`.
- **`pre-commit` adds one gate `npm run check` does not have.** The local
  `npm-coverage-direct` hook runs `npm run test:coverage:direct:commit`
  (`--base HEAD`), the changed-pair direct-coverage gate. It matches
  `extensions/pi-claude-marketplace/**/*.ts` and `tests/**/*.ts`, so all six code
  files in scope trip it. Expect a focused test run inside the pre-commit pass.
- **Two pre-commit hooks write.** The local `prettier` hook runs `--write`, and
  `mdformat` / the `texthooks` fixers rewrite in place. A pass that rewrites a file
  reports `Failed ... files were modified by this hook` and the fix is to restage and
  re-run, not to re-edit by hand.
- **The out-of-scope tracked pair is already invisible to pre-commit.** The config's
  top-level `exclude: ^(\.agents/|\.claude/|\.codex/|...)` covers both
  `.claude/settings.json` and `.codex/config.toml`.
- **Markdown is mdformat's, not prettier's.** `format:check` globs only
  `**/*.{js,json,ts}` plus `scripts/**/*.mjs`. Never run `prettier --write` over
  `README.md`, `CHANGELOG.md`, or `docs/prd/*.md`.
- **`CHANGELOG.md` already carries both entries** under `## [Unreleased]`, as the top
  two bullets. No version bump belongs in this commit — the house convention bumps at
  PR time, not commit time.
- **`generatedName` is already name-constrained.** `discover.ts:89` calls
  `assertSafeName(sourceName, ...)` before `discover.ts:91` composes
  `generatedAgentName(pluginName, sourceName)`. The threat model below rests on that.

## Why `--files` and not `--all-files`

`pre-commit run --all-files` matches what CI's Lint job runs, but its writing hooks
would rewrite tracked files outside this task's nine — and reverting those would mean
touching the operator's tree. Scoped `--files` can only rewrite files this task already
owns. Any pre-existing violation elsewhere is CI's to report and is not this change's
regression. If CI Lint does go red on an unrelated file after the push, that is a
separate task, not a reason to widen this commit.

## Tasks

1. **Run the full gate and confirm it is actually green.**

   Run it once, capture the exit code from `npm` directly rather than from a pipe, and
   keep the 5996-test spec stream out of context by sending it to a log:

   ```
   npm run check > "${TMPDIR:-/tmp}/uwq-check.log" 2>&1; echo "EXIT=$?"
   tail -40 "${TMPDIR:-/tmp}/uwq-check.log"
   ```

   `EXIT=0` is the verdict. The tail is for diagnosis only — do not read a green-looking
   tail as a pass. A piped `npm run check` reports the exit status of the last stage of
   the pipe, so a failing gate can print a clean-looking tail and still have failed;
   that is why the status is captured from `$?` on the unpiped command.

   On a red gate, grep the log for the first failing sub-gate and make the smallest edit
   that closes it, inside the nine files only. Then re-run the whole command — not just
   the sub-gate — because the chain short-circuits and later gates never ran.

   verify:

   ```
   npm run check > "${TMPDIR:-/tmp}/uwq-check.log" 2>&1; echo "EXIT=$?"
   ```

   done: the command prints `EXIT=0`.

2. **Run pre-commit over the nine paths, restage, and commit atomically.**

   Put the nine paths in one shell array so the same list drives the hook run, the
   staging, and the scope assertion — three uses, one source of truth. Do not retype
   them per command, and do not let a shell variable word-split (this repo has been bitten
   by that in fish; use bash and quote `"${FILES[@]}"`).

   - Run `SKIP=trufflehog pre-commit run --files "${FILES[@]}"`. If any hook reports that
     files were modified, inspect `git status --porcelain`, confirm the rewrites landed
     only inside the nine, and re-run until the pass is clean.
   - `git add -- "${FILES[@]}"`. Explicit paths, `--` separator, nothing else.
   - Assert the staged set before committing: `git diff --cached --name-only` must list
     exactly nine paths and must not contain `.claude/` or `.codex/`. If it does, unstage
     and start the staging step over — do not commit and repair afterwards, because a
     failed hook means no commit happened and amending would rewrite the previous one.
   - Commit with `SKIP=trufflehog git commit -F <file>`. Use a message file, not `-m`:
     backticks inside a `-m` string get executed by the shell and vanish, and this message
     needs to name `tools:`, `excludeTools`, and `mcpServers`.

   Message shape — Conventional Commits, title at most 72 characters, body lines at most
   80, no milestone or phase references:

   ```
   fix(agents): inherit Pi defaults when tools is omitted (#179)
   ```

   The body covers three things: an omitted source `tools:` now emits no allowlist so
   pi-subagents grants its default builtins (matching Claude Code, which grants every
   tool when the key is absent); `disallowedTools` on such an agent now maps to
   `excludeTools`; and the dropped `allowed-tools` and `mcpServers` fields each emit
   targeted guidance instead of a bare summary line, with the `mcpServers` warning
   naming the pi-subagents agent-overrides settings key.

   After committing, check the message against the gate that would have run it if the
   hook were installed, and check that the tree outside the nine is untouched.

   verify:

   ```
   git show --stat --name-only --format= HEAD | grep -c . ;
   git show --name-only --format= HEAD | grep -Ec '^(\.claude/|\.codex/)' ;
   SKIP=trufflehog pre-commit run gitlint --hook-stage commit-msg \
     --commit-msg-filename "$(git rev-parse --git-dir)/COMMIT_EDITMSG" ;
   git status --porcelain
   ```

   done: the first count is `9`; the second is `0`; `gitlint` passes; and
   `git status --porcelain` still shows the two out-of-scope `M` entries and the four
   `??` entries, with no in-scope path left modified or staged.

## Out of scope

- **Any change to behavior.** If the gate exposes a genuine defect in the issue-179
  work, stop and report it rather than redesigning inside a commit task.
- **The version bump.** `package.json`, `sonar-project.properties`, and
  `package-lock.json` stay untouched. The house convention offers the bump when the PR
  is created; the `CHANGELOG.md` entries already sit under `## [Unreleased]`.
- **Opening the PR.** This task ends at the commit.
- **The `.planning/quick/260913-uwq-*/` artifacts.** They are not part of the nine-path
  code commit. If the orchestrator does not commit them itself, make a second, separate
  `docs:` commit for them alone — two atomic commits, neither mixing planning docs with
  source.
- **Pre-existing violations in tracked files outside the nine**, should CI Lint's
  `--all-files` pass surface any.

<threat_model>

ASVS level 1, blocking threshold `high`. Nothing here reaches that threshold, so this
plan carries no mitigation task. The change surface is conversion of third-party plugin
frontmatter into a generated Pi agent file.

## Trust Boundaries

| Boundary | Description |
| --- | --- |
| third-party plugin repo -> agent conversion | Plugin-authored YAML field values cross into generated agent frontmatter and into user-visible warnings |
| converted agent -> pi-subagents runtime | The emitted `tools:` / `excludeTools:` allowlist decides which tools the child agent may call |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-uwq-01 | Elevation of Privilege | `mapTools` omitted-tools branch, `bridges/agents/convert.ts` | medium | accept | An agent that declares no `tools:` now receives pi-subagents' default builtins in place of the old `read,bash,edit`. This is upstream parity — Claude Code grants every tool when the key is absent — so the conversion stops being more restrictive than the thing it converts. Both narrowing paths survive: `disallowedTools` still maps through `TOOL_MAP` into `excludeTools`, and `assertMappedToolsNonEmpty` still rejects an explicit `tools:` that maps to nothing (AG-11). Below the `high` blocking threshold. |
| T-uwq-02 | Tampering | `droppedFieldWarnings` name interpolation, `bridges/agents/convert.ts` | low | accept | The `mcpServers` warning interpolates `generatedName` into a settings-key string. That name derives from a `sourceName` already passed through `assertSafeName` at `bridges/agents/discover.ts:89` before `generatedAgentName` composes it at `:91`. The string is display-only and is never written back to Pi settings, so it is not an injection sink. No new surface. |
| T-uwq-03 | Tampering | `excludeTools` emission, `bridges/agents/frontmatter.ts` | low | accept | Only `TOOL_MAP`-resolved Pi names populate `excludeTools`; the same loop discards every unmapped plugin token, so no raw plugin-authored string reaches the generated file. The emitter's existing newline normalization of provenance and body values is unchanged by this work. |
| T-uwq-SC | Tampering | npm/pip/cargo installs | low | accept | This task installs no packages. It runs existing npm scripts and makes one commit, so no Package Legitimacy Audit applies and no legitimacy checkpoint is needed. |

</threat_model>

## Success Criteria

- `npm run check` exits 0 on the tree as committed.
- `SKIP=trufflehog pre-commit run --files "${FILES[@]}"` exits 0 with nothing left
  unstaged.
- `git show --name-only --format= HEAD` lists exactly the nine in-scope paths.
- `.claude/settings.json`, `.codex/config.toml`, `.mcp.json`, `AGENTS.md`,
  `.codegraph/`, and `.claude/CLAUDE.md` are neither staged, committed, nor reverted.
- The commit title is Conventional Commits, at most 72 characters, with no phase or
  milestone reference, and `gitlint` accepts the message.
